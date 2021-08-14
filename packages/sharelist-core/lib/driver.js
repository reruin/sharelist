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

  const get = async ({ id }) => {
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

  const getStream = async (id, options) => {
    let data = await get({ id })

    if (data.error) return data

    if (data.download_url) {
      let reqHeaders = {}
      if (data.extra.proxy?.headers) {
        Object.assign(reqHeaders, data.extra.proxy.headers)
      }

      let { data, headers } = await app.request(data.download_url, { headers: reqHeaders, responseType: 'stream' })
      if (data) {
        return { stream: data, acceptRanges: headers?.['accept-ranges'] == 'bytes' }
      }
    } else {
      const [protocol] = parseProtocol(data.id)
      const driver = app.getDriver(protocol)

      if (driver && driver.createReadStream) {
        return { stream: await driver.createReadStream(id, options), acceptRanges: true }
      }
    }

    return { error: { message: "CAN'T GET STREAM" } }
  }

  //获取文本内容
  const getContent = async (id) => {
    let { stream } = await getStream(id)

    if (!stream || stream.error) return ''

    return await app.utils.transfromStreamToString(stream)
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

    let data = await driver.path(fid, { ...query })

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

  return { list, get, getStream, getContent }
}
