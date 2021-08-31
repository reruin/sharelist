const { WebDAVServer } = require('@sharelist/webdav')
const { get } = require('../../../sharelist-core/lib/request')


const waitStreamFinish = (src, dst) => new Promise((resolve) => {
  src.pipe(dst)
  src.resume()
  console.log('waitStreamFinish')
  dst.on('data', (chunk) => {
    console.log(chunk)
  })
  dst.on('finish', () => resolve(true)).on('error', () => resolve(false))
})

const parsePath = v => v.replace(/(^\/|\/$)/g, '').split('/').map(decodeURIComponent).filter(Boolean)

const createDriver = (driver, { proxy, baseUrl } = {}) => {
  const commands = {
    async ls(path) {
      let p = path.replace(/(^\/|\/$)/g, '')
      let data = await driver.list({ paths: p ? p.split('/').map(decodeURIComponent) : [] })
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
    async get(path) {
      return await driver.get({ paths: parsePath(path) })
    },
    async createReadStream(path, options) {
      let data = await driver.get({ paths: parsePath(path) })
      let download_url = `${baseUrl}/api/drive/get?download=true&id=${encodeURIComponent(data.id)}`

      if (!options.reqHeaders) options.reqHeaders = {}
      options.reqHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'

      if (data.download_url && !proxy) {
        return {
          status: 302,
          body: download_url
        }
      } else {
        let res = await driver.createReadStream(data.id, options)
        if (res.stream) res.body = res.stream
        return res
      }
    },
    async upload(path, readStream) {

      readStream.pause?.()

      let paths = parsePath(path)

      let name = paths.pop()

      let data = await driver.get({ paths })

      if (!data.id) {
        return { error: { code: 404 } }
      }

      let writeStream = await driver.createWriteStream(data.id, { name })

      if (writeStream.error) return writeStream

      let ret = await waitStreamFinish(readStream, writeStream)

      if (ret == false) {
        return {
          error: { code: 500 }
        }
      }

    },
    async mkdir(path) {
      let paths = parsePath(path)
      let name = paths.pop()
      let parentData = await driver.get({ paths })
      return await driver.mkdir(parentData.id, { name })
    },
    async rm(path) {
      let paths = parsePath(path)
      let data = await driver.get({ paths })
      return await driver.rm(data.id)
    },
    async mv(path, target) {
      let paths = parsePath(path)
      let targetPaths = parsePath(target)
      let data = await driver.get({ paths })

      //只支持同目录重命名
      if (data.id && paths.slice(0, -1).join('/') === targetPaths.slice(0, -1).join('/')) {
        let targetName = targetPaths.pop()
        let res = await driver.rename(data.id, targetName)

        if (res.error) {
          return res
        } else {
          return { status: 0, data: res }
        }

      } else {
        return {
          error: { code: 404 }
        }
      }

    }
  }
  return (cmd, ...options) => commands[cmd]?.(...options)
}

const isWebDAVRequest = (ctx) => {
  return /(Microsoft\-WebDAV|FileExplorer|WinSCP|WebDAVLib|WebDAVFS|rclone|Kodi|davfs2|sharelist\-webdav)/i.test(ctx.request.headers['user-agent'])
}

module.exports = (app) => {
  app.addSingleton('webdav', async () => {
    const { config } = app.sharelist
    const webdavPath = config.webdab_path || '/'
    const webdavProxy = config.webdav_proxy || true

    const webdavServer = new WebDAVServer({
      driver: createDriver(app.sharelist, {
        request: app.curl,
        proxy: webdavProxy,
        baseUrl: 'http://localhost:33001/'
      }), base: webdavPath
    })

    app.router.all(webdavPath + ':path(.*)', async (ctx, next) => {
      if (webdavPath == '/' || webdavPath == '') {
        if (!isWebDAVRequest(ctx)) {
          await next()
          return
        }
      }
      console.log('[WebDAV]', ctx.method, ctx.url)

      const resp = await webdavServer.request(ctx.req)

      const { headers, status, body } = resp

      if (headers) {
        ctx.set(headers)
      }

      if (status == 302) {
        ctx.redirect(body)
      } else {
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