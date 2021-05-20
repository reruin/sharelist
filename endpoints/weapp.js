class RSS {
  constructor(app) {
    this.name = 'WeApp Server'
    this.app = app
    this.path = '/_weapp_'
    this.start()
  }

  start() {
    let { app, path } = this
    let port = app.getConfig('port')
    let sitename = app.getConfig('title')
    let router = app.router().all(path + ':path(.*)', async (ctx, next) => {
      await this.onRequest(ctx, next)
    })
    app.web().use(router.routes())

    this.zeroconf = app.bonjour.publish({ name: `ShareList WeApp(${sitename})`, type: 'http', port, txt: { path } })
  }

  async onRequest(ctx, next) {
    let url = ctx.params.path
    let resp = await this.app.command('ls', url)
    if( resp ){
      ctx.type = 'application/json'
      if(resp.children){
        ctx.body = { status:0, result:this.createDir(resp.children) }
      }else{
        // stream
        // this.sendFile(ctx,data)

        this.app.sendStream(ctx , resp.url , resp.outputType , resp.protocol , resp)

        // ctx.body = { status:0, result:this.createFile(resp) }
      }
    }else{
      ctx.body = {
        status:-1
      }
    }

  }

  async sendFile(ctx,data){

    let { outputType = 'url' , protocol } = data

    let headers = {}

    if(outputType === 'file'){
      return await app.sendStream(ctx , url , outputType , protocol , data)
    }
    else{
      return await app.sendHTTPFile(ctx , id , data)
    }
  }

  createDir(items) {
    let path = ''
    return items.filter(i => i.hidden !== true).map(i => {
      i.href = ((path + '/' + encodeURIComponent(i.name))).replace(/\/{2,}/g, '/')
      return {
        name:i.name,
        size:i.size,
        mtime:i.updated_at,
        type:i.type
      }
    })
  }

  createFile(file){
    return {
      name:file.name,
      size:file.size,
      url:file.url,
      headers:file.headers
    }
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