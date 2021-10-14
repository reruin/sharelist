const utils = require('./utils')
const request = require('./request')
const { PassThrough } = require('stream')

const cache = {}

const clone = (obj) => {
  // console.log(obj)
  let type = typeof obj
  if (type == 'number' || type == 'string' || type == 'boolean' || type === undefined || type === null) {
    return obj
  }

  if (obj instanceof Array) {
    return obj.map((i) => clone(i))
  }

  if (obj instanceof Object) {
    let copy = {}
    for (let attr in obj) {
      if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr])
    }
    return copy
  }

  return obj
}

module.exports = (app) => {

  const encode = (id, { key, protocol }) => {
    return app.encode({ key, protocol, path: id })
  }

  const decode = (id) => {
    let { path: fid, key, protocol } = app.decode(id)
    return { fid, meta: { key, protocol } }
  }

  const getDriver = (id) => app.getDriver(id.split('://')[0])

  const getByPath = async (paths) => {
    if (paths.length == 0) {
      return {
        id: 'root://sharelist', name: 'Sharelist', type: 'folder', size: 0, ctime: Date.now(), mtime: Date.now()
      }
    }

    let parentPath = paths.slice(0, paths.length - 1)
    let filename = paths[paths.length - 1]
    let parent = await forwardTrack(parentPath)

    if (parent.error) return undefined

    let data = parent?.files.find(i => i.name == filename)
    /*
    if (data?.id) {
      let driver = getDriver(data.id)

      if (driver.cache !== false) {
        let cacheId = `${data.id}#get`
        let r = app.cache.get(cacheId)
        if (r) {
          console.log(`[CACHE] ${new Date().toISOString()}  ${cacheId}`)
          return r
        }

        let max_age = data.max_age || 0

        if (max_age) {
          app.cache.set(`${data.id}#get`, data, max_age)
        }
      }

    }

    if (data && data.type == 'file') {
      //data.download_url = await get_download_url(data.id)
    }
    */
    return data
  }

  const get_download_url = async (id) => {
    // 所有driver 均支持 get_download_url
    let cacheId = `${id}#download`
    let r = app.cache.get(cacheId)
    if (r) {
      console.log(`[CACHE] ${new Date().toISOString()} ${cacheId}`)
      return r
    }

    let driver = getDriver(id)

    if (driver?.get_download_url) {
      let { fid, meta } = decode(id)

      let data = await driver.get_download_url(fid, meta.key)

      if (data.url && driver.cache !== false) {
        if (data.max_age) {
          app.cache.set(`${id}#download`, data, data.max_age)
        }
      }

      return data
    }
  }

  // 如何保持 ById 和 ByPath 结果的一致性？
  const getById = async (id) => {
    let cacheId = `${id}#get`
    let r = app.cache.get(cacheId)
    if (r) {
      console.log(`[CACHE] ${new Date().toISOString()} ${cacheId}`)
      return r
    }

    let driver = getDriver(id)

    // 可能get接口
    if (!driver?.get) return { error: { message: '' } }

    let { fid, meta } = decode(id)

    let data = await driver.get(fid, meta.key)

    data.id = encode(data.id, meta)

    if (driver.cache !== false) {
      let max_age = data.max_age || 0

      if (max_age) {
        app.cache.set(`${id}#get`, data, max_age)
      }
    }

    return data
  }

  const getParentId = async (id) => {
    let data = await getById(id)
    return data?.extra.parent_id
  }

  /**
   * list
   * @param {object} options 
   * @param {string} options.id
   * @param {array} options.paths
   * @param {object} options.query
   * @param {boolean} options.ignoreInterceptor
   * 
   * @returns {array<file>}
   */
  const list = async ({ paths = [], id, query, ignoreInterceptor = false } = {}) => {
    const interceptor = ignoreInterceptor ? null : app.hookLifetime('onListed')

    let data = id ? await fastTrack(id, query, interceptor) : await forwardTrack([...paths], query, interceptor)

    let ret = clone(data)

    if (ret.files) {
      ret.files.forEach((i) => {
        i.path = [...paths, i.name].join('/')
      })
    }
    return ret
  }

  const stat = async ({ paths }) => {
    let parentPath = paths.slice(0, paths.length - 1)
    let filename = paths[paths.length - 1]
    let parent = await forwardTrack(parentPath)
    if (parent.error) return undefined
    if (paths.length == 0) {
      return {
        id: parent.id,
        type: 'folder',
        name: 'sharelist root',
        size: parent.size || Number.MAX_SAFE_INTEGER
      }
    } else {
      return parent?.files.find(i => i.name == filename)
    }
  }

  /**
   * 由于部分driver没有完整的get 接口,因而此方法主要用于获取下载地址
   * @param {object} options 
   * @param {string} options.id
   * @param {array} options.paths
   * 
   * @returns {object}
   */
  const get = async ({ paths = [], id }) => {
    let data

    if (!id && paths) {
      data = await getByPath(paths)
      id = data.id
    }

    if (id) {
      let r = await getById(id)

      if (!r.error) {
        data = r
      }
    }

    if (!data) return app.error({ code: 404 })

    // if (data.extra && data.extra.path) {
    //   let drive = root().files.find((i) => id.startsWith(i.id))
    //   data.path = drive.name + data.extra.path + '/' + data.name
    // }
    return { ...data }
  }


  /**
   * 返回指定id的只读流
   * @param {string} id file id
   * @param {object} options 
   * @param {object | undefined} options.reqHeaders
   * @param {number} options.start offset start
   * @param {number} options.end offset end
   * 
   * @returns { stream , acceptRanges , headers? , status?  }
   */
  const createReadStream = async (id, options = {}) => {

    let data = await get({ id })

    if (data.error) return data

    if (data.download_url) {
      let reqHeaders = options.reqHeaders || {}

      if (data.extra.proxy?.headers) {
        Object.assign(reqHeaders, data.extra.proxy.headers)
      }

      if (options.start) {
        reqHeaders['range'] = `bytes=${options.start}-${options.end || ''}`
      }

      let { data: stream, headers, status, error } = await request(data.download_url, { headers: reqHeaders, responseType: 'stream' })

      if (!error) {
        return { stream, headers, status, acceptRanges: headers?.['accept-ranges'] == 'bytes' }
      }
    } else {
      const driver = getDriver(id)
      let { fid, meta } = decode(id)

      if (driver && driver.createReadStream) {
        return { stream: await driver.createReadStream(fid, options, meta.key), acceptRanges: true }
      }
    }

    app.error({ code: 501, message: "Not implemented" })

  }

  //获取文本内容
  const getContent = async (id) => {
    try {
      let { stream } = await createReadStream(id)
      if (!stream) return null
      return await app.utils.transfromStreamToString(stream)
    } catch (e) {
      return null
    }
  }

  /**
   * 返回指定一个可写流
   * @param {string} id file id
   * @param {object} options 
   * @param {number} options.size
   * @param {string} options.name
   * @param {string} options.sha1
   * 
   * @returns { stream:WritableStream , doneHandler:Function  }
   * @public
   */
  const createWriteStream = async (id, options) => {
    let driver = getDriver(id)

    if (driver?.upload) {
      let passStream = new PassThrough()

      let { fid, meta } = decode(id)

      let done = (doneCall) => {
        done.handler = doneCall
      }
      driver.upload(fid, { ...options, stream: passStream }, meta.key).then(res => {
        done.handler?.(res)
      })

      return { stream: passStream, done }
    }

    app.error({ code: 501, message: "Not implemented" })
  }

  /**
   * upload
   * @param {string} id
   * @param {object} options
   * @param {number} options.size
   * @param {string} options.name
   * @param {string} options.sha1
   * @returns {object}
   * 
   * @public
   */
  const upload = async (id, options) => {
    let driver = getDriver(id)
    options?.stream?.pause?.()
    if (driver?.upload) {
      let { fid, meta } = decode(id)
      let data = await driver.upload(fid, options, meta.key)
      if (driver.cache !== false) {
        app.cache.remove(`${id}#list`)
      }
      return data
    }

    app.error({ code: 501, message: "Not implemented" })
  }

  /**
   * mkdir
   * @param {string} id
   * @param {string} name
   * @param {object} options
   * @returns {object}
   * 
   * @public
   */
  const mkdir = async (id, name, options = {}) => {
    let driver = getDriver(id)
    if (driver?.mkdir) {
      let { fid, meta } = decode(id)
      let data = await driver.mkdir(fid, name, options, meta.key)
      if (driver.cache !== false) {
        app.cache.remove(`${id}#list`)
      }
      return data
    }

    app.error({ code: 501, message: "Not implemented" })
  }

  /**
   * remove
   * @param {string} id
   * @param {object} options
   * @returns {object}
   * 
   * @public
   */
  const rm = async (id) => {
    let driver = getDriver(id)

    if (driver?.rm) {
      let { fid, meta } = decode(id)
      let data = await driver.rm(fid, meta.key)

      if (driver.cache !== false) {
        // clear cache
        app.cache.remove(`${id}#get`)
        if (!data.parent_id) {
          data.parent_id = await getParentId(id)
        }
        if (data.parent_id) app.cache.remove(`${encode(data.parent_id, meta)}#list`)
      }

      return data
    }
    app.error({ code: 501, message: "Not implemented" })
  }

  /**
   * remove
   * @param {string} id
   * @param {string} name new file name
   * @returns {object}
   * 
   * @public
   */
  const rename = async (id, name, options = {}) => {
    let driver = getDriver(id)
    if (driver?.rename) {
      let { fid, meta } = decode(id)
      let data = await driver.rename(fid, name, options, meta.key)

      if (driver.cache !== false) {
        // clear cache
        app.cache.remove(`${id}#get`)

        //clear parent cache
        if (!data.parent_id) {
          data.parent_id = await getParentId(id)
        }
        if (data.parent_id) app.cache.remove(`${encode(data.parent_id, meta)}#list`)
      }

      return data
    }
    app.error({ code: 501, message: "Not implemented" })
  }

  //only support same protocol  
  const mv = async (id, target_id, options = {}) => {
    if (app.isSameDisk(id, target_id)) {

      let driver = getDriver(id)

      if (driver?.mv) {
        let { fid, meta } = decode(id)
        let { fid: target_fid } = decode(target_id)

        let cache = driver.cache !== false
        let parent_id
        //需要预先获得parent_id
        if (cache) {
          parent_id = await getParentId(id)
        }

        let data = await driver.mv(fid, target_fid, meta.key)

        if (options.name) {
          await driver.rename(data.id, options.name, {}, meta.key)
        }

        if (cache) {
          //在有缓存的情况下 取得的是原位置的父级id
          if (!data.parent_id) {
            data.parent_id = parent_id
          }

          if (data.parent_id) app.cache.remove(`${encode(data.parent_id, meta)}#list`)

          app.cache.remove(`${target_id}#list`)
          app.cache.remove(`${id}#get`)
        }

        return data
      }
    }
    app.error({ code: 501, message: "Not implemented" })
  }

  const root = () => {
    let disk = app.config.drives.map((i) => ({
      id: i.path.split('?')[0],
      fid: i.name,
      name: i.name,
      size: 0,
      mtime: '',
      ctime: '',
      type: 'folder',
    }))

    return { id: 'root://', type: 'folder', driveName: '', files: disk }
  }

  const listById = async (id, query) => {
    let cacheId = `${id}#list`
    let r = app.cache.get(cacheId)
    if (r) {
      console.log(`[CACHE] ${new Date().toISOString()} ${cacheId}`)
      return r
    }

    let driver = getDriver(id)

    if (!driver) return app.error({ code: 501, message: "Not implemented" })

    let { fid, meta } = decode(id)

    let files = await driver.list(fid, { ...query }, meta.key)

    for (let i of files) {
      i.id = encode(i.id, meta)
    }

    let data = { id, files }

    if (driver.cache !== false) {
      let max_age_dir = app.config.max_age_dir || 0

      if (max_age_dir) {
        if (!query?.search) app.cache.set(`${id}#list`, data, max_age_dir)
      }
    }

    return data
  }

  const fastTrack = async (id, query, interceptor) => {

    const data = await listById(id, query)

    if (interceptor) {
      return await interceptor(data, query)
    }
    return data
  }

  /*
   * Get data by path
   *
   * @param {string} [p] path id
   * @param {function} [interceptor] interceptor
   * @return {array|object}
   * @api private
   */
  const forwardTrack = async (paths, query, interceptor) => {
    let hit = root()

    //扩展唯一的文件夹
    if (app.config.expand_single_disk && hit.files && hit.files.length == 1) {
      paths.unshift(hit.files[0].name)
    }

    // root path
    if (paths.length == 0) {
      return hit
    }

    for (let i = 0; i < paths.length; i++) {

      if (hit.files) {
        hit = hit.files.find((j) => j.name == paths[i])
        if (!hit) {
          return app.error({ code: 404, message: `Can't find [${paths[i]}] folder` })
        }
      }

      let driver = getDriver(hit.id)

      if (!driver) return app.error({ code: 501, message: "Not implemented" })

      hit = await listById(hit.id, paths.length - 1 == i ? { ...query } : {})

      if (interceptor) {
        hit = await interceptor(hit, { ...query, paths: paths.slice(0, i + 1) })
      }
      if (hit.error) return app.error(hit.error)
    }
    return hit
  }

  return {
    list,
    get,
    stat,
    mkdir,
    rm,
    rename,
    mv,
    upload,
    createReadStream,
    createWriteStream,
    get_download_url,

    getContent
  }
}
