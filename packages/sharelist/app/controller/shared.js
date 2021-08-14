const { URLSearchParams } = require('url')
const promisify = require('util').promisify
const extname = require('path').extname
const fs = require('fs')
const calculate = require('etag')
const stat = promisify(fs.stat)
const mime = require('mime')

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
    ret.preview = true
  }

  if (params.has('sort')) {
    let s = params.get('sort')
    let r = {}
    for (let i of s.split('+')) {
      let pairs = i.split(':')
      if (pairs.length == 2) {
        r[pairs[0]] = pairs[1]
      }
    }
    ret.sort = r
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

exports.createRuntime = async (ctx) => {

  let query = parseQuery(ctx.querystring)
  let token = ctx.get('authorization') || ctx.query.token

  let runtime = {
    method: ctx.method,
    token,
    query
  }

  if (ctx.method == 'POST') {
    let { id, path, ...query } = ctx.request.body
    if (id) {
      runtime.id = id
    } else {
      runtime.paths = (path || '').replace(/\/$/, '').split('/').filter(Boolean).map(decodeURIComponent)
      runtime.path = '/' + runtime.paths.join('/')
      runtime.driveName = runtime.paths[0]
    }
    runtime.query = query
  } else {

    if (ctx.params.id) {
      let [driveName, id] = ctx.params.id.split('/')
      runtime.driveName = driveName
      runtime.id = id
    } else if (ctx.query.id) {
      runtime.id = decodeURIComponent(ctx.query.id)
    } else {
      runtime.paths = (ctx.params.path || '').replace(/\/$/, '').split('/').filter(Boolean).map(decodeURIComponent)
      runtime.path = '/' + runtime.paths.join('/')
      runtime.driveName = runtime.paths[0]
    }
  }

  return runtime
}

exports.selectSource = (sources) => {
  let map = {}
  sources.forEach(i => {
    map[i.quality] = i.src
  })
  console.log('hit', map['HD'] || map['SD'] || map['LD'])
  return map['HD'] || map['SD'] || map['LD']
}

const notfound = {
  ENOENT: true,
  ENAMETOOLONG: true,
  ENOTDIR: true
}

exports.sendfile = async (ctx, path) => {
  try {
    const stats = await stat(path)

    if (!stats) return null
    if (!stats.isFile()) return stats

    ctx.response.status = 200
    ctx.response.lastModified = stats.mtime
    ctx.response.length = stats.size
    ctx.response.type = extname(path)

    if (!ctx.response.etag) {
      ctx.response.etag = calculate(stats, {
        weak: true
      })
    }

    // fresh based solely on last-modified
    switch (ctx.request.method) {
      case 'HEAD':
        ctx.status = ctx.request.fresh ? 304 : 200
        break
      case 'GET':
        if (ctx.request.fresh) {
          ctx.status = 304
        } else {
          ctx.body = fs.createReadStream(path)
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
 * 
 * @param {ctx} ctx 
 * @param {object} sharelist 
 * @param {object} data 
 */
exports.send = async (ctx, app, data) => {
  let { download_url } = data
  if (download_url) {
    //the request need proxy
    if (data.extra.proxy) {
      let reqHeaders = mergeHeaders(ctx.headers, data.extra.proxy.headers)
      let { data: stream, status, error, headers } = await app.curl(download_url, { headers: reqHeaders, responseType: 'stream' })
      if (error) {
        ctx.status = 500
      } else {
        ctx.set(headers)
        ctx.status = status
        ctx.body = stream
      }
    } else {
      ctx.redirect(download_url)
    }
  } else {
    let range = getRange(ctx.header.range, data.size) || { start: 0, end: data.size - 1 }
    let { stream, error, acceptRanges = false } = await app.sharelist.getStream(data.id, range || {})
    if (stream) {
      let options = acceptRanges ? { range } : {}
      let headers = createHeaders(data, options)
      ctx.set(headers)
      ctx.status = acceptRanges ? 206 : 200
      ctx.body = stream
    } else {
      ctx.status = 404
      ctx.body = error?.message || `can't find stream`
    }
  }
}