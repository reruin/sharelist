const utils = require('./utils')
const request = require('./request')
const { PassThrough } = require('stream')

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

const sortFiles = (files, orderBy) => {
  let [key, isAsc] = orderBy
  let aVal = isAsc ? 1 : -1
  let bVal = isAsc ? -1 : 1
  return files.sort((a, b) => a[key] > b[key] ? aVal : bVal).sort((a, b) => {
    if (a.type == 'folder' && b.type != 'folder') {
      return -1
    } else if (a.type != 'folder' && b.type == 'folder') {
      return 1
    } else {
      return 0
    }
  })

}

/**
 * driver 采用 id 作为首选寻址方式
 */
module.exports = (app) => {

  const getDrive = (id) => app.getDrive(id)

  /**
   * list
   * @param {object} options 
   * @param {string} options.id
   * @param {array} options.paths
   * @param {object} options.params
   * @param {boolean} options.ignoreInterceptor
   * 
   * @returns {array<file>}
   */
  const list = async ({ paths = [], id, params, ignoreInterceptor = false } = {}) => {
    await app.emit('beforeList', { paths, id, params })
    let data = id ? await listById(id, params) : await listFromPathAddressing([...paths], params)

    /*
    if (params.orderBy && data.files) {
      data.files = sortFiles([...data.files], params.orderBy)
    }
    */
    await app.emit('afterList', { paths, id, data, params })

    return clone(data)
  }

  /**
   * @param {object} options 
   * @param {string} options.id
   * @param {array} options.paths
   * 
   * @returns {object}
   */
  const get = async ({ paths = [], id }, options) => {
    let data

    if (!id && paths) {
      data = await stat(paths, more)
      id = data.id
    }
    if (id) {
      let r = await getById(id, options)
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
   * get file by paths
   * @param array<string> paths
   * @returns 
   */
  const stat = async (paths) => {
    let parentPath = paths.slice(0, paths.length - 1)
    let filename = paths[paths.length - 1]
    let parent = await listFromPathAddressing(parentPath)
    if (parent.error) return undefined

    if (paths.length == 0) {
      return {
        id: parent.id,
        type: 'folder',
        name: '@sharelist_root',
        size: parent.size || Number.MAX_SAFE_INTEGER
      }
    } else {
      return parent?.files.find(i => i.name == filename)
    }
  }


  /**
   * 根据uri获取资源详情
   * @param {*} uri 
   * @returns 
   */
  const getById = async (uri, { more = false, enableCache = true } = {}) => {
    let { drive, encode, config, id, name } = await getDrive(uri)

    // if (isRoot(id)) {
    //   return {
    //     id: encode(id),
    //     name,
    //     type: 'folder'
    //   }
    // }

    let cacheId = `${encode(id)}#get`
    if (config.cache !== false && enableCache) {
      let r = app.cache.get(cacheId)
      if (r) {
        console.log(`[CACHE] ${new Date().toISOString()} ${cacheId}`)
        return r
      }
    }

    if (!drive?.get) return { error: { message: '' } }

    let data = await drive.get(id, more)
    data.id = encode(data.id)

    //鉴于某些driver get 无法获取name和size，此处需通过 parent files 进行补充
    if (!data.name && data.extra?.parent_id) {
      let parent = await listById(encode(data.extra.parent_id))
      let last = parent.files.find(i => i.id == data.id)
      if (last) {
        data.name = last.name
        data.size = last.size
        if (last.type == 'file') {
          if (last.extra.md5) data.extra.md5 = last.extra.md5
          if (last.extra.sha1) data.extra.sha1 = last.extra.sha1
        }
      }
    }

    if (config.cache !== false) {
      let max_age = data.max_age || 0

      if (max_age) {
        app.cache.set(cacheId, data, max_age)
      }
    }

    return data
  }


  /**
   * 获取可下载链接
   * @param {*} uri 
   * @returns 
   */
  const get_download_url = async (uri) => {
    let cacheId = `${uri}#download`
    let r = app.cache.get(cacheId)
    if (r) {
      console.log(`[CACHE] ${new Date().toISOString()} ${cacheId}`)
      return r
    }

    let { drive, config, id } = await getDrive(uri)

    if (drive?.get_download_url) {

      let data = await drive.get_download_url(id)

      if (data.url && config.cache !== false) {
        if (data.max_age) {
          app.cache.set(`${id}#download`, data, data.max_age)
        }
      }

      return data
    }
  }

  const getParentId = async (id) => {
    let data = await getById(id)
    return data?.extra?.parent_id
  }


  /**
   * 返回指定id的只读流
   * @param {string} uri
   * @param {object} options 
   * @param {object | undefined} options.reqHeaders
   * @param {number} options.start offset start
   * @param {number} options.end offset end
   * 
   * @returns { stream , enableRanges , headers? , status?  }
   */
  const createReadStream = async (uri, options = {}) => {
    let { drive, id } = await getDrive(uri)

    let default_ua = app.config.default_ua
    console.log('dua', default_ua)
    if (drive?.createReadStream) {
      let stream = await drive.createReadStream(id, options)
      stream.once('error', () => { })
      return { stream, enableRanges: true }
    } else {
      let data = await get({ id: uri })
      if (data.download_url) {
        let { start, end, reqHeaders = {}, ...reqOptions } = options || {}

        if (data.extra.proxy?.headers) {
          Object.assign(reqHeaders, data.extra.proxy.headers)
        }
        if (data.extra.req_user_agent && !(reqHeaders['user-agent'] || reqHeaders['User-Agent'])) {
          reqHeaders['user-agent'] = default_ua
        }
        if (options.start !== undefined) {
          reqHeaders['range'] = `bytes=${start}-${end || ''}`
        }
        reqOptions.headers = reqHeaders
        reqOptions.responseType = 'stream'

        let { data: stream, headers, status, error } = await request(data.download_url, reqOptions)

        if (!error) {
          return { stream, headers, status, enableRanges: headers?.['accept-ranges'] == 'bytes' || status == 206 || headers?.['content-range'] }
        }
      }
    }

    throw { code: 501, message: "Not implemented" }
  }

  //获取文本内容
  const getContent = async (id, charset = 'utf-8') => {
    try {
      let { stream } = await createReadStream(id)
      if (!stream) return null
      return await utils.transfromStreamToString(stream, charset)
    } catch (e) {
      return null
    }
  }

  /**
   * 返回指定可写流
   * @param {string} uri
   * @param {object} options 
   * @param {number} options.size
   * @param {string} options.name
   * @param {string} options.sha1?
   * @param {string} options.md5?
   * 
   * @returns { stream:WritableStream , doneHandler:Function  }
   * @public
   */
  const createWriteStream = async (uri, options) => {
    let { drive, id, encode, config } = await getDrive(uri)

    if (drive?.upload) {
      let passStream = new PassThrough()

      let done = (cb) => {
        done.cb = cb
      }
      drive.upload(id, passStream, { ...options }).then(res => {
        done.cb?.(res)
      })

      return { stream: passStream, done }
    }

    app.error({ code: 501, message: "Not implemented" })
  }

  /**
   * upload
   * @param {string} uri
   * @param {stream | () => stream} stream
   * @param {object} options
   * @param {number} options.size
   * @param {string} options.name
   * @param {string} options.hash
   * @param {object} options.state
   * @param {string} options.conflictBehavior replace|rename|fail
   * 
   * @returns {object}
   * 
   * @public
   */
  const upload = async (uri, stream, options) => {
    let { drive, id, config, encode } = await getDrive(uri)
    stream?.pause?.()

    if (drive?.upload) {
      if (!options.state) options.state = {}
      if (!options.hash) options.hash = {}
      let data = await drive.upload(id, stream, options)
      if (data.id) {
        data.id = encode(data.id)
        if (config.cache !== false) {
          app.cache.remove(`${encode(id)}#list`)
        }
      }

      return data
    }

    app.error({ code: 501, message: "Not implemented" })
  }

  /**
   * mkdir
   * @param {string} uri
   * @param {string|Array<string>} name
   * @param {object} options
   * @param {boolean} strict 严格模式，此模式会事先判断是否存在目录
   * @returns {object}
   * 
   * @public
   */
  const mkdir = async (uri, name, options = {}, strict = false) => {
    let { drive, id, encode, config } = await getDrive(uri)

    if (drive?.mkdir) {
      if (typeof name == 'string') {
        name = [name]
      }
      let data
      while (name.length && id) {
        let curName = name.shift(), targetExist
        if (strict) {
          let dir = await drive.list(id)
          targetExist = dir.files?.find(i => i.name == curName)
        }

        if (targetExist) {
          data = { id: targetExist.id, name: targetExist.name, parent_id: id }
        } else {
          data = await drive.mkdir(id, curName, options)
          if (config.cache !== false) {
            app.cache.remove(`${encode(id)}#list`)
          }
        }
        if (data.id) id = data.id

      }

      if (data.id) data.id = encode(data.id)

      return data
    }

    app.error({ code: 501, message: "Not implemented" })
  }

  /**
   * remove
   * @param {string|Array<string>} uri
   * @param {object} options
   * @returns {object}
   * 
   * @public
   */
  const rm = async (uri) => {
    let { drive, id, encode, config } = await getDrive(uri)
    if (drive?.rm) {
      let data = await drive.rm(id)

      if (config.cache !== false) {
        // clear cache
        app.cache.remove(`${encode(id)}#get`)
        if (!data.parent_id) {
          data.parent_id = await getParentId(uri)
        }
        if (data.parent_id) app.cache.remove(`${encode(data.parent_id)}#list`)
      }

      return data
    }
    app.error({ code: 501, message: "Not implemented" })
  }

  /**
   * rename
   * @param {string} uri
   * @param {string} name new file name
   * @returns {object}
   * 
   * @public
   */
  const rename = async (uri, name, options = {}) => {
    let { drive, id, encode, config } = await getDrive(uri)
    if (drive?.rename) {
      let data = await drive.rename(id, name, options)

      if (config.cache !== false) {
        // clear cache
        app.cache.remove(`${uri}#get`)

        //clear parent cache
        if (!data.parent_id) {
          data.parent_id = await getParentId(uri)
        }
        if (data.parent_id) app.cache.remove(`${encode(data.parent_id)}#list`)
      }

      return data
    }
    app.error({ code: 501, message: "Not implemented" })
  }

  //only support same protocol  
  const mv = async (uri, target_uri, options = {}) => {
    if (app.isSameDrive(uri, target_uri)) {

      let { drive, id, encode, config } = await getDrive(uri)

      if (drive?.mv) {
        let cache = config.cache !== false

        let { id: target_id } = await getDrive(target_uri)

        // get origin parent id
        let originParentId
        if (!options.copy) {
          originParentId = await getParentId(uri)
        }

        let data = await drive.mv(id, target_id, { ...options })

        // clear cache
        if (cache) {
          //在有缓存的情况下 取得的是原位置的父级id
          if (!data.parent_id) {
            data.parent_id = target_id
          }

          //clear new parent cache
          app.cache.remove(`${encode(target_id)}#list`)

          //clear target cache
          app.cache.remove(`${uri}#get`)

          //clear origin parent cache if request move
          if (!options.copy) {
            originParentId = data.origin_parent_id || originParentId
            app.cache.remove(`${encode(originParentId)}#list`)
          }
        }

        return data
      }
    }

    app.error({ code: 501, message: "Not implemented" })
  }

  const listById = async (uri, params = {}) => {
    let { drive, id, encode, config } = await getDrive(uri)

    let { pagination, ...options } = params

    if (app.config.per_page && pagination !== false) {
      options.perPage = app.config.per_page
    }
    const cacheable = !options.search && config.cache !== false

    let cacheId = `${encode(id)}#list`

    if (cacheable) {
      let r = app.cache.get(cacheId)
      if (!!r) {
        console.log(`[CACHE] ${new Date().toISOString()} ${cacheId}`)

        //adjust sort
        if (params.orderBy && r.files) {
          r.files = sortFiles([...r.files], params.orderBy)
        }
        return { ...r, config }
      }
    }

    if (!drive) return app.error({ code: 501, message: `Not implemented. (Resource URI:${uri})` })

    let { id: realId, files, maxAge, nextPage } = await drive.list(id, options)

    files.forEach(i => {
      i.id = encode(i.id)
      if (i.extra?.parent_id) {
        i.extra.parent_id = encode(i.extra.parent_id)
      }
    })

    let data = { id: encode(realId || id), files }

    // Cache will be disabled if enable pagination
    if (cacheable && files?.length > 0 && (!params.nextPage && !nextPage)) {
      let maxAgeDir = maxAge || config.maxAgeDir || app.config.max_age_dir || 0

      if (maxAgeDir) {
        app.cache.set(cacheId, data, maxAgeDir)
      }
    }

    return { ...data, config, nextPage }
  }

  /*
   * Get data by path
   *
   * @param {string} [p] path id
   * @param {function} [interceptor] interceptor
   * @return {array|object}
   * @api private
   */
  const listFromPathAddressing = async (paths, params) => {
    let hit = await app.getRoot(params)
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

      //if (!drive) return app.error({ code: 501, message: "Not implemented" })
      hit = await listById(hit.id, paths.length - 1 == i ? { ...params } : {})

      await app.emit('afterList', { data: hit, params, paths: paths.slice(0, i + 1) })

    }
    return hit
  }

  /**
   * 根据id 获取路径层级
   * @param {*} uri 
   * @returns 
   */
  const pwd = async (uri) => {
    let dirs = []
    let { encode, protocol, name, drive, id } = await getDrive(uri)
    if (drive.pwd) {
      dirs = await drive.pwd(id)
      if (dirs) {
        dirs.forEach(i => {
          i.id = encode(i.id)
        })
      }
    } else {
      while (id) {

        if (drive.isRoot(id)) break

        let data = await getById(encode(id))

        if (!data) break

        dirs.unshift(data)

        if (!data?.extra?.parent_id || data.id == '@drive_root') break

        id = data?.extra.parent_id
      }
    }
    console.log('>>>>>pwd', dirs)
    return [{ id: 'root', name, type: 'folder' }, ...dirs.map(i => ({ id: i.id, name: i.name, type: i.type }))]
    // if(parent?.extra)
  }

  const pwd_path = async (path) => {

  }

  const clearSession = async (uri, data) => {
    let { drive, id } = await getDrive(uri)
    drive.clearSession?.(id, data)
  }

  const hashUpload = async (uri, { hash, name, size }) => {
    let { drive, id, config, encode } = await getDrive(uri)

    if (!config?.hashUpload) {
      app.error({ code: 429 })
    }
    let hashType = typeof config.hashUpload == 'string' ? config.hashUpload : config.hashUpload.type
    let options = {
      name,
      state: {},
      hash: {
        [hashType]: hash
      }
    }
    if (size) {
      options.size = size
    }
    let { completed, ...data } = await drive.upload(id, null, options)

    if (completed) {
      data.id = encode(data.id)
      if (config.cache !== false) {
        app.cache.remove(`${encode(id)}#list`)
      }
      return data
    }
    // }
    app.error({ code: 404, message: "file is non-exist" })
  }

  return {
    list,
    get,
    stat,
    mkdir,
    rm,
    rename,
    mv,
    pwd,
    upload,
    hashUpload,
    clearSession,
    createReadStream,
    createWriteStream,
    get_download_url,
    getContent
  }
}
