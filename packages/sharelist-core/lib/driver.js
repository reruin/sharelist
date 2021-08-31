const utils = require('./utils')
const request = require('./request')

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

  /**
   * 列出指定id
   * @param {object} options 
   * @param {string} options.id
   * @param {array} options.paths
   * @param {object} options.query
   * 
   * @returns { files | error  }
   */
  const list = async ({ paths = [], id, query } = {}) => {
    const filter = app.hookLifetime('onListed')

    let data = id ? await fastTrack(id, query, filter) : await forwardTrack([...paths], query, filter)

    if (data.error) return { error: data.error }

    let ret = clone(data)

    if (ret.files) {
      ret.files.forEach((i) => {
        i.path = [...paths, i.name].join('/')
      })
    }
    return ret
  }

  const get = async ({ paths = [], id }) => {
    if (!id && paths) {
      if (paths.length == 0) {
        return {
          id: 'root://sharelist', name: 'Sharelist', type: 'folder', size: 0, ctime: Date.now(), mtime: Date.now()
        }
      } else {
        id = await getIdFromPath(paths)
      }
    }

    if (!id) return { error: { code: 404, message: `can't find file in this paths: ${paths.join('/')}` } }

    const [protocol, fid] = parseProtocol(id)

    let driver = app.getDriver(protocol)

    if (!driver) return { error: { code: 500, message: 'miss driver' } }

    let data = await driver.get(fid)

    if (data.extra && data.extra.path) {
      let drive = root().files.find((i) => id.startsWith(i.id))
      data.path = drive.name + data.extra.path + '/' + data.name
    }

    return data
  }

  const getIdFromPath = async (paths) => {
    let parentPath = paths.slice(0, paths.length - 1)
    let filename = paths[paths.length - 1]
    let parent = await forwardTrack(parentPath)

    if (parent.error) return undefined

    return parent?.files.find(i => i.name == filename)?.id
  }

  /**
   * 返回指定id的内容
   * @param {string} id file id
   * @param {object} options 
   * @param {object | undefined} options.reqHeaders
   * @param {number} options.start offset start
   * @param {number} options.end offset end
   * 
   * @returns { stream , acceptRanges, error  }
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

      console.log('reqHeaders', reqHeaders)

      let { data: stream, headers, status, error } = await request(data.download_url, { headers: reqHeaders, responseType: 'stream' })

      if (!error) {
        return { stream, headers, status, acceptRanges: headers?.['accept-ranges'] == 'bytes' }
      }
    } else {
      const [protocol] = parseProtocol(data.id)
      const driver = app.getDriver(protocol)

      if (driver && driver.createReadStream) {
        return { stream: await driver.createReadStream(id, options), acceptRanges: true }
      }
    }

    return { error: { code: 501, message: "Not implemented" } }
  }

  //获取文本内容
  const getContent = async (id) => {
    let { stream } = await getStream(id)

    if (!stream || stream.error) return ''

    return await app.utils.transfromStreamToString(stream)
  }

  const createWriteStream = async (id, options) => {
    const [protocol, fid] = parseProtocol(id)

    let driver = app.getDriver(protocol)

    if (driver?.createWriteStream) {
      let writeStream = await driver.createWriteStream(id, options)

      if (writeStream.error) return writeStream

      return writeStream
    }

    return { error: { code: 501, message: "Not implemented" } }
  }

  const mkdir = async (id, options) => {
    const [protocol, fid] = parseProtocol(id)
    let driver = app.getDriver(protocol)

    if (driver?.mkdir) {
      return await driver.mkdir(id, options)
    }

    return { error: { code: 501, message: "Not implemented" } }
  }

  const rm = async (id, options = {}) => {
    const [protocol, fid] = parseProtocol(id)
    let driver = app.getDriver(protocol)

    if (!driver?.rm) {
      return { error: { code: 501, message: "Not implemented" } }
    }

    return await driver.rm(id, options)
  }

  const rename = async (id, name) => {
    const [protocol, fid] = parseProtocol(id)

    let driver = app.getDriver(protocol)

    if (!driver?.rename) {
      return { error: { code: 501, message: "Not implemented" } }
    }

    return await driver.rename(id, name)

  }

  const mv = async (id, target) => {
    const [protocol, fid] = parseProtocol(id)

    const [targetProtocol] = parseProtocol(target)

    //only support same protocol
    if (targetProtocol === protocol) {
      let driver = app.getDriver(protocol)

      if (driver?.mv) {
        return await driver.mv(id, target)
      }
    }

    return { error: { code: 501, message: "Not implemented" } }
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

  const parseProtocol = (p) => {
    return [p.split('://')[0], p]
  }

  const fastTrack = async (id, query, filter) => {
    const [protocol, fid] = parseProtocol(id)

    let driver = app.getDriver(protocol)

    if (!driver) return { error: { code: 500, message: 'miss driver' } }

    let data = await driver.list(fid, { ...query })

    if (filter) {
      await filter(data, query, filter)
    }
    return data
  }

  /*
   * Get data by path
   *
   * @param {string} [p] path id
   * @param {function} [filter] filter
   * @return {array|object}
   * @api private
   */
  const forwardTrack = async (paths, query, filter) => {
    let hit = root(),
      protocol,
      id

    //扩展唯一的文件夹
    if (app.config.expand_single_disk && hit.files && hit.files.length == 1) {
      paths.unshift(hit.files[0].name)
    }

    // root path
    if (paths.length == 0) {
      return hit
    }

    for (let i = 0; i < paths.length; i++) {
      if (hit.error) {
        return hit
      }

      if (hit.files) {
        hit = hit.files.find((j) => j.name == paths[i])
        if (hit) {
          ;[protocol, id] = parseProtocol(hit.id)
        } else {
          return { error: { code: 404, message: `Can't find [${paths[i]}] folder` } }
        }
      }

      let driver = app.getDriver(protocol)

      if (!driver) return { error: { message: 'miss driver' } }

      let data = await driver.list(id, paths.length - 1 == i ? { ...query } : {})

      if (data.error) {
        return data
      }

      hit = clone(data)

      if (filter) {
        await filter(hit, { ...query, paths: paths.slice(0, i + 1) })
      }
    }
    return hit
  }

  return {
    list,
    get,
    mkdir,
    rm,
    rename,
    mv,
    createReadStream,
    createWriteStream,

    getStream: createReadStream,
    getContent
  }
}
