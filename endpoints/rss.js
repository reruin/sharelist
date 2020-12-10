class RSS {
  constructor(app) {
    this.name = 'RSS Server'
    this.app = app
    this.path = '/_rss'
    this.start()
  }

  start() {
    let { app, path } = this
    let port = app.getConfig('port')
    let router = app.router().all(this.path + ':path(.*)', async (ctx, next) => {
      await this.onRequest(ctx, next)
    })
    app.web().use(router.routes())

    this.zeroconf = app.bonjour.publish({ name: 'ShareList RSS', type: 'http', port, txt: { path } })
  }

  async onRequest(ctx, next) {
    let url = ctx.params.path
    let resp = await this.app.command('ls', url)
    if( resp ){
      let k = this.createDir(resp.children)
      ctx.type = 'application/rss+xml'
      ctx.body = k
    }else{
      ctx.body = {
        code:404
      }
    }

    await next()
  }

  createDir(items) {
    let path = ''
    let body = items.filter(i => i.hidden !== true).map(i => {
      let href = ((path + '/' + encodeURIComponent(i.name))).replace(/\/{2,}/g, '/')
      return `<item>
          <title>${i.name}</title>
          <link>${href}</link>
          <description>${i.name}</description>
          <pubDate>${i.updated_at}</pubDate>
          <enclosure url="${href}"
      length="${i.size}" type="${i.type}" />
        </item>`
    })

    return `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
        ${body.join('')}
      </rss>`
  }

  restart() {
    if (this.zeroconf) {
      this.zeroconf.stop(()=>{
        this.start()
      })
    }else{
      this.start()
    }
  }
}

module.exports = RSS