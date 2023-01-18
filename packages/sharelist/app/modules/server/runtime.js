const { URLSearchParams } = require('url')
const promisify = require('util').promisify
const extname = require('path').extname
const fs = require('fs')
const calculate = require('etag')
const stat = promisify(fs.stat)
const mime = require('mime')
const { Readable } = require('stream')
const { nanoid } = require('nanoid')

const parseQuery = (str) => {
  let params = new URLSearchParams(str)
  let ret = {}
  if (params.has('forward')) {
    ret.forward = true
  }
  if (params.has('download')) {
    ret.download = true
  }
  if (params.has('preview')) {
    ret.preview = params.get('preview')
  }

  if (params.has('order_by')) {
    let s = params.get('order_by')
    let r = {}
    for (let i of s.split('+')) {
      let pairs = i.split(':')
      if (pairs.length == 2) {
        r[pairs[0]] = pairs[1]
      }
    }
    ret.order_by = r
  }

  if (params.has('auth')) {
    ret.auth = params.get('auth')
  }
  if (params.has('search')) {
    ret.search = decodeURIComponent(params.get('search'))
  }

  return ret
}

const mergeHeaders = (a, b) => {
  const exclude = ['host', 'accept-encoding']
  let pre = { ...a, ...b }
  let headers = {}
  for (let key in pre) {
    if (exclude.includes(key) == false) {
      headers[key] = pre[key]
    }
  }
  return headers
}

const getRange = (r, total) => {
  if (r) {
    let [, start, end] = r.match(/(\d*)-(\d*)/);
    start = start ? parseInt(start) : 0
    end = end ? parseInt(end) : total - 1

    return { start, end }
  }
}

const createHeaders = (stats, { maxage, immutable, range } = { maxage: 0, immutable: false }) => {
  let fileSize = stats.size
  let fileName = stats.name

  let headers = {}

  headers['Last-Modified'] = new Date(stats.mtime).toUTCString()

  headers['Content-Type'] = mime.getType(fileName)

  if (range) {
    let { start, end } = range
    headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`
    headers['Content-Length'] = end - start + 1
    headers['Accept-Ranges'] = 'bytes'
  } else {
    header['Content-Range'] = `bytes 0-${fileSize - 1}/${fileSize}`
    headers['Content-Length'] = fileSize
  }

  headers['Content-Disposition'] = `attachment;filename=${encodeURIComponent(fileName)}`
  return headers
}

const parseSort = (order_by) => {
  let cats = ['name', 'size', 'ctime', 'mtime']
  if (order_by) {
    let [cat, type = 'asc'] = order_by.toLowerCase().split(' ')
    if (cats.includes(cat)) {
      return [cat, type == 'asc' ? 1 : 0]
    }
  }
}

const parsePathAndDrive = (runtime, path) => {
  runtime.paths = (path || '').replace(/\/$/, '').split('/').filter(Boolean).map(decodeURIComponent)
  runtime.path = '/' + runtime.paths.join('/')
  runtime.driveName = runtime.paths[0]
}

exports.createRuntime = async (ctx) => {

  let token = ctx.get('authorization') || ctx.query.token

  let runtime = {
    method: ctx.method,
    token,
    headers: ctx.headers
  }

  let { id, path, ...others } = ctx.method == 'POST' ? ctx.request.body : ctx.query

  if (id) {
    runtime.id = id
  } else {
    parsePathAndDrive(runtime, path)
  }

  let { order_by, next_page, ...options } = ctx.method == 'POST' ? others : parseQuery(ctx.querystring)
  if (order_by) {
    options.orderBy = parseSort(order_by)
  }

  if (next_page) {
    options.nextPage = next_page
  }

  runtime.params = options

  return runtime
}

exports.selectSource = (sources, quality = 'HD') => {
  let map = {}
  sources.forEach(i => {
    map[i.quality] = i.src
  })
  return map[quality] || map['HD'] || map['SD'] || map['LD']
}

const notfound = {
  ENOENT: true,
  ENAMETOOLONG: true,
  ENOTDIR: true
}

exports.sendfile = async (ctx, path, replacer) => {
  try {
    const stats = await stat(path)

    if (!stats) return null
    if (!stats.isFile()) return stats
    ctx.response.status = 200
    ctx.response.lastModified = stats.mtime
    ctx.response.type = mime.getType(path)
    if (!replacer) {
      ctx.response.length = stats.size
      if (!ctx.response.etag) {
        ctx.response.etag = calculate(stats, {
          weak: true
        })
      }
    }

    console.log(ctx.request.method, path, ctx.request.fresh, !replacer)
    // fresh based solely on last-modified
    switch (ctx.request.method) {
      case 'HEAD':
        ctx.status = ctx.request.fresh && !replacer ? 304 : 200
        break
      case 'GET':
        if (ctx.request.fresh && !replacer) {
          ctx.status = 304
        } else {
          if (replacer) {
            ctx.body = replacer(fs.readFileSync(path, 'utf-8'))
          } else {
            ctx.body = fs.createReadStream(path)
          }
        }
        break
    }

    return stats
  } catch (err) {
    if (notfound[err.code]) return
    err.status = 500
    throw err
  }
}

/**
 * send sharelist data
 * @param {ctx} ctx 
 * @param {object} sharelist 
 * @param {object} data 
 */
exports.send = async (sharelist, data) => {
  let { download_url } = data
  let isGlobalProxy = !!sharelist.config.proxy_enable
  if (download_url) {
    //the request need proxy
    if (data.extra?.proxy || isGlobalProxy) {
      let reqHeaders = mergeHeaders(data.reqHeaders, data.extra?.proxy?.headers || {})

      let options = {
        headers: reqHeaders, responseType: 'stream'
      }
      if (data.extra?.proxy_server) {
        options.proxy = data.extra?.proxy_server
      }
      let { data: stream, status, error, headers } = await sharelist.request(download_url, options)

      // compatible 
      if (headers['accept-ranges'] == 'bytes' && headers['content-range']) {
        status = 206
      }

      if (error) {
        return {
          status: 500
        }
      } else {
        return { headers, status, body: stream }
      }
    } else {
      return { redirect: download_url }
    }
  } else {
    let range = getRange(data.reqHeaders.range, data.size) || { start: 0, end: data.size - 1 }
    let { stream, error, status, headers, enableRanges = false } = await sharelist.driver.createReadStream(data.id, range)
    let isReqRange = !!data.reqHeaders.range
    if (stream) {
      let options = enableRanges ? { range } : {}
      return {
        headers: headers || createHeaders(data, options),
        status: status || (isReqRange && enableRanges ? 206 : 200),
        body: stream
      }

    } else {
      return {
        status: 404,
        body: error?.message || `can't find stream`
      }
    }
  }
}

// 暂停 : destroy() => close. 完成 end => close. 客户端异常 error => close
const createUploadManage = () => {
  let tasks = {}
  let tasksMetaMap = {}
  const remove = (id) => {
    if (id && tasks[id]) {
      tasks[id].req.destroy(new Error('AbortError'))
    }
  }

  const add = (data, id) => {
    if (id && tasks[id]) {
      remove(id)
    }
    tasks[id] = data

    data.req.once('error', () => {
      data.controller.abort()
    })

    data.req.once('close', () => {
      if (tasksMetaMap[data.taskId]) {
        delete tasksMetaMap[data.taskId]
      }
      delete tasks[id]
    })
  }

  //临时上传链
  const createTask = (data) => {
    let taskId = nanoid()
    tasksMetaMap[taskId] = data
    return taskId
  }
  const getTask = (taskId) => tasksMetaMap[taskId]

  const updateTask = (taskId, data) => {
    let src = tasksMetaMap[taskId]
    if (src) {
      for (let i in data) {
        src[i] = data[i]
      }
    }
  }

  return { remove, add, createTask, getTask, updateTask }
}

const createUpdateManage = (sharelist) => {
  let tasks = {}

  const remove = (id) => {
    if (id && tasks[id]) {
      tasks[id].req.destroy(new Error('AbortError'))
    }
  }

  const add = (data, id) => {
    if (id && tasks[id]) {
      remove(id)
    }
    tasks[id] = data

    data.req.once('error', () => {
      data.controller.abort()
    })

    data.req.once('close', () => {
      delete tasks[id]
    })
  }

  const get = () => {

  }

  return { remove, add, get }
}

exports.uploadManage = createUploadManage()

exports.createUpdateManage = createUpdateManage

exports.emptyStream = () => {
  const controller = new AbortController();
  const stream = new Readable({
    read(size) {
      this.destroy()
    },
    signal: controller.signal
  })

  stream.pause()

  return { stream, controller }
}