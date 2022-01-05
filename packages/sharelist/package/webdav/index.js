const { WebDAVServer } = require('@sharelist/webdav')

const parsePath = v => v.replace(/(^\/|\/$)/g, '').split('/').map(decodeURIComponent).filter(Boolean)

const safeCall = fn => new Promise((resolve, reject) => {
  Promise.resolve(fn).then(resolve).catch(() => resolve())
})

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

const getRange = (r, total) => {
  if (r) {
    let [, start, end] = r.match(/(\d*)-(\d*)/);
    start = start ? parseInt(start) : 0
    end = end ? parseInt(end) : total - 1

    return { start, end }
  }
}
const createDriver = (driver, { proxy, baseUrl } = {}) => {
  const commands = {
    async ls(path) {
      let p = path.replace(/(^\/|\/$)/g, '')
      let data = await driver.list({
        paths: p ? p.split('/').map(decodeURIComponent) : [],
        ignoreInterceptor: true
      })
      if (data.files?.length > 0) {
        data.files
          .sort((a, b) => (a.type == 'folder' ? -1 : 1))
          .forEach((i) => {
            if (i.type == 'file') {
              i.download_url = baseUrl + '/api/drive/get?download=true&id=' + encodeURIComponent(i.id)
            }
          })
      }
      return data
    },
    async stat(path) {
      //console.log('stat', parsePath(path),)
      try {
        return await driver.stat({ paths: parsePath(path) })
      } catch (error) {
        return { error }
      }
    },
    async get(path, options) {
      let data = await driver.get({ paths: parsePath(path) })
      if (!options.reqHeaders) options.reqHeaders = {}
      delete options.reqHeaders.connection
      options.reqHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
      if (data && data.download_url && !data.extra.proxy && !proxy()) {
        return {
          status: 302,
          body: data.download_url
        }
      } else {
        let range = getRange(options.reqHeaders.range, data.size) || { start: 0, end: data.size - 1 }
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

      let data = await driver.stat({ paths })

      let existData = await driver.stat({ paths: [...paths, name] })

      if (existData) {
        await driver.rm(existData.id)
      }

      if (!data.id) {
        return { error: { code: 404 } }
      }
      let ret = await driver.upload(data.id, { name, size, stream })
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
      let parentData = await driver.stat({ paths })
      return await driver.mkdir(parentData.id, name)
    },
    async rm(path) {
      let paths = parsePath(path)
      let data = await driver.stat({ paths })
      return await driver.rm(data.id)
    },
    async mv(path, targetPath) {
      if (path === targetPath) {
        return {
          error: { code: 403 }
        }
      }
      let paths = parsePath(path)
      let targetPaths = parsePath(targetPath)
      let data = await driver.stat({ paths })

      let srcName = paths[paths.length - 1], dstName = targetPaths[targetPaths.length - 1]

      if (!data?.id) {
        return {
          error: { code: 404 }
        }
      }

      let target = await safeCall(driver.stat({ paths: targetPaths }))

      if (target?.id) {

        let enableMove = await driver.isSameDisk(data.id, target.id)

        if (!enableMove) {
          return {
            error: { code: 501 }
          }
        }

        // 目标是文件夹 移动
        if (target.type == 'folder') {
          let res = await driver.mv(data.id, target.id)
          if (res?.error) {
            return res
          }
          return { status: 201 }
        }
        //目标是文件 冲突
        else {
          return {
            error: { code: 409 }
          }
        }
      }
      // 不存在目标 
      else {
        // 目标上级
        let targetParent = await safeCall(driver.stat({ paths: targetPaths.slice(0, -1) }))
        //存在文件夹上级
        if (targetParent?.type == 'folder') {
          //是否在相同磁盘
          let isSameDisk = await driver.isSameDisk(data.id, targetParent.id)
          if (isSameDisk) {
            // console.log(data, targetParent)
            // 相同父级目录
            if (data.extra.parent_id && data.extra.parent_id == targetParent.extra?.fid) {
              await driver.rename(data.id, dstName)
            } else {
              let options = {}
              if (dstName && dstName != srcName) options.name = dstName
              await driver.mv(data.id, targetParent.id, options)
            }

            return { status: 201 }
          }
        }

        return {
          error: { code: 409 }
        }
      }

    }
  }
  return (cmd, ...options) => commands[cmd]?.(...options)
}

const isWebDAVRequest = (ctx, webdavPath) => {
  if (webdavPath == '/') {
    return /(Microsoft\-WebDAV|FileExplorer|WinSCP|WebDAVLib|WebDAVFS|rclone|Kodi|davfs2|sharelist\-webdav|RaiDrive|nPlayer|LibVLC|PotPlayer|gvfs)/i.test(ctx.request.headers['user-agent']) || ('translate' in ctx.request.headers) || ('overwrite' in ctx.request.headers) || ('depth' in ctx.request.headers)
  } else {
    return ctx.params.path.startsWith(webdavPath)
  }
}

module.exports = (app) => {
  app.addSingleton('webdav', async () => {
    const { config } = app.sharelist
    const webdavPath = config.webdav_path || '/'

    const webdavServer = new WebDAVServer({
      driver: createDriver(app.sharelist, {
        request: app.curl,
        proxy: () => !!config.webdav_proxy,
        baseUrl: webdavPath
      }),
      base: webdavPath,
      auth: (user, pass) => {
        return !config.webdav_pass || (config.webdav_user === user && config.webdav_pass === pass)
      }
    })

    app.router.all(':path(.*)', async (ctx, next) => {
      let webdavPath = config.webdav_path || '/'
      if (!isWebDAVRequest(ctx, webdavPath)) {
        await next()
        return
      }
      console.log('[WebDAV]', ctx.method, ctx.url, '<-->', ctx.ip)
      const resp = await webdavServer.request(ctx.req, { base: webdavPath })
      const { headers, status, body } = resp
      if (status == 302) {
        ctx.redirect(body)
      } else {

        if (headers) {
          ctx.set(headers)
        }

        if (status) {
          ctx.status = parseInt(status)
        }

        if (body) {
          // ctx.set('Content-Length', body.length)
          ctx.body = body
        }
      }
    })

  })

}