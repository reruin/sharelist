const { WebDAVServer } = require('@sharelist/webdav')

const isWebDAVRequest = (ctx, webdavPath) => {
  if (webdavPath == '/') {
    return /(Microsoft\-WebDAV|FileExplorer|WinSCP|WebDAVLib|WebDAVFS|rclone|Kodi|davfs2|sharelist\-webdav|RaiDrive|nPlayer|LibVLC|PotPlayer|gvfs)/i.test(ctx.request.headers['user-agent']) || ('translate' in ctx.request.headers) || ('overwrite' in ctx.request.headers) || ('depth' in ctx.request.headers)
  } else {
    return ctx.params.path.startsWith(webdavPath)
  }
}

module.exports = (sharelist) => {
  const { config } = sharelist
  const webdavPath = config.webdav_path || '/'
  const webdavServer = new WebDAVServer({
    driver: sharelist.driver.createAction({
      useProxy: () => !!config.webdav_proxy,
      baseUrl: webdavPath
    }),
    base: webdavPath,
    auth: (user, pass) => {
      return !config.webdav_pass || (config.webdav_user === user && config.webdav_pass === pass)
    }
  })

  return {
    route: [{
      method: 'all',
      path: ':path(.*)',
      flush: 'pre',
      handler: async (ctx, next) => {
        let webdavPath = config.webdav_path || '/'

        if (!isWebDAVRequest(ctx, webdavPath)) {
          await next()
          return
        }
        console.log('[WebDAV]', ctx.method, ctx.url, '<-->', ctx.ip)
        console.log(ctx.headers)
        // if (ctx.method == 'PROPPATCH') console.log(ctx.headers)
        let res
        try {
          res = await webdavServer.request(ctx.req, { base: webdavPath })
        } catch (e) {
          console.log(e)
          res = { status: e?.code || 500 }
        }
        const { headers, status, body } = res
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
      }
    }]
  }

}