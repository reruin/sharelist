class WebDAV {
  constructor(ctx){
    this._http_status = null
    this.path = null
    this.ctx = ctx
    this.davPoweredBy = null
    this.httpAuthRealm = "ShareList WebDAV"

    this.allows = ['GET','PUT','HEAD','OPTIONS','PROPFIND']
  }


  serveRequest(ctx , next){
    this.ctx = ctx

    let uri = ctx.protocol + "://" + ctx.hostname + ctx.pathname
    let path_info = ctx.params.path

    if (path_info == '') {
      path_info = "/"
    }

    this.base_uri = this.uri = uri

    this.path = decodeURIComponent(path_info)

    this.setBody('<xml></xml>')
  }


  setBody(body){
    this.ctx.type = 'text/xml; charset="utf-8"'
    this.ctx.body = body
  }
}

module.exports = new WebDAV()