/**
 * 提供文件名寻址操作
 * ls / rm / mkdir / stat / upload / get / mv(rename)
 */

const parsePath = v => v.replace(/(^\/|\/$)/g, '').split('/').map(decodeURIComponent).filter(Boolean)

const getRange = (r, total) => {
  if (r) {
    let [, start, end] = r.match(/(\d*)-(\d*)/);
    start = start ? parseInt(start) : 0
    end = end ? parseInt(end) : total - 1

    return { start, end }
  }
}

const createHeaders = (data, { maxage, immutable, range } = { maxage: 0, immutable: false }) => {
  let fileSize = data.size
  let fileName = data.name

  let headers = {}

  headers['Last-Modified'] = new Date(data.mtime).toUTCString()

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

const createAction = (driver, { useProxy, baseUrl } = {}) => ({
  async ls(path) {
    let p = path.replace(/(^\/|\/$)/g, '')
    let data = await driver.list({
      paths: p ? p.split('/').map(decodeURIComponent) : [],
      params: { perPage: 0, sort: ['name', 1] }
    })
    return data?.files
  },
  async stat(path) {
    console.log('stat', parsePath(path))
    try {
      return await driver.stat(parsePath(path))
    } catch (error) {
      console.log(error)
      return { error }
    }
  },
  async get(path, options) {
    let data = await driver.get({ paths: parsePath(path) })
    if (!options.reqHeaders) options.reqHeaders = {}
    delete options.reqHeaders.connection
    options.reqHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
    if (data && data.download_url && !data.extra.proxy && !useProxy()) {
      return {
        status: 302,
        body: data.download_url
      }
    } else {
      let range = getRange(options.reqHeaders.range, data.size) || { start: 0, end: data.size ? (data.size - 1) : '' }
      let { stream, status, headers, acceptRanges = false } = await driver.createReadStream(data.id, range)
      let isReqRange = !!options.reqHeaders.range
      if (stream) {
        let options = acceptRanges ? { range } : {}
        let resHeaders = headers || createHeaders(data, options)
        return {
          body: stream,
          status: status || (isReqRange && acceptRanges ? 206 : 200),
          headers: resHeaders
        }
      }
    }
  },
  async upload(path, stream, { size }) {
    stream.pause?.()

    let paths = parsePath(path)

    let name = paths.pop()

    let data = await driver.stat(paths)

    let existData = await driver.stat([...paths, name])

    if (existData) {
      await driver.rm(existData.id)
    }

    if (!data.id) {
      return { error: { code: 404 } }
    }
    let ret = await driver.upload(data.id, stream, { name, size })
    if (!ret) {
      return {
        error: { code: 500 }
      }
    } else {
      return ret
    }

  },
  async mkdir(path) {
    let paths = parsePath(path)
    let name = paths.pop()
    let parentData = await driver.stat(paths)
    return await driver.mkdir(parentData.id, name)
  },
  async rm(path) {
    let paths = parsePath(path)
    let data = await driver.stat(paths)
    return await driver.rm(data.id)
  },
  // /d/e/1.txt -> /d
  async mv(path, destPath, copy) {
    // The destination path can NOT be in the source path (include the same path)
    // e.g. /a/b => /a/b , /a/b => /a/b/c , ( /a/b => /a/b1, /a/b => /a/b1/c )
    console.log('mv:', path, destPath)
    let paths = parsePath(path)
    let destPaths = parsePath(destPath)

    if ((destPaths.join('/') + '/').startsWith(paths.join('/' + '/'))) throw { code: 409 }

    let data = await driver.stat(paths)
    if (!data?.id) throw { code: 404 }

    let srcId = data.id

    let isSameDir = paths.length == destPaths.length && paths.slice(0, -1).join('/') == destPaths.slice(0, -1).join('/')

    // rename
    if (isSameDir) {
      if (paths.slice(-1)[0] == destPaths.slice(-1)[0]) throw { code: 409 }

      if (!copy) {
        await driver.rename(srcId, destPaths.slice(-1)[0])
        return
      }
    }

    let dest = await driver.stat(destPaths)

    let destId, destName, srcName = paths.pop()

    //if destination exists
    if (dest?.id) {
      // destination must be a folder
      if (dest.type != 'folder' && dest.type != 'drive') throw { code: 409 }

      destId = dest.id

    }
    // destination does not exist

    else {
      let destParent = await driver.stat(destPaths.slice(0, -1))
      //dest parent must be a folder
      if (destParent?.type != 'folder' && destParent?.type != 'drive') throw { code: 404 }

      destName = destPaths.pop()
      destId = destParent.id

    }

    let options = { copy }

    //move and rename
    if (destName && srcName != destName) options.name = destName

    console.log('move:', options)
    await driver.mv(srcId, destId, options)

    return { status: 201 }
  }

})


module.exports = createAction