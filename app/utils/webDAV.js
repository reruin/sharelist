const request = require('request')

const { sendFile , sendHTTPFile} = require('./sendfile')

const http = require('./http')

const slashify = (p) => (p[p.length-1] != '/' ? `${p}/` : p)

const propsCreate = (data , props) => {

  let out = ''
  for(let key in props){
    if(key == 'getlastmodified'){
      out += `<D:${key}>${data.updated_at}</D:${key}>`
    }
    if(key == 'displayname'){
      out += `<D:${key}>${data.name}</D:${key}>`
    }
    if(key == 'getcontentlength'){
      out += `<D:${key}>${parseInt(data.size || 0)}</D:${key}>`
    }
    if(key == 'resourcetype'){
      out += `<D:${key}>${data.type == 'folder' ? '<D:collection/>' : ''}</D:${key}>`
    }
    if(key == 'getcontenttype' && data.type != 'folder'){
      out += `<D:${key}>${data.mime}</D:${key}>`
    }
    if(key == 'creationdate'){
      out += `<D:${key}>${data.created_at}</D:${key}>`
    }
  }

  return out
}

const propsParse = (data) => {
  let props = data['D:propfind']['D:prop'][0]
  let ret = {}
  for(let prop in props){
    ret[prop.split(':')[1]] = props[prop][0]
  }
  console.log('req:',ret)
  return ret
}


class WebDAV {
  constructor(ctx , files){
    this._http_status = null
    this.path = null
    this.ctx = ctx
    this.davPoweredBy = null
    this.httpAuthRealm = "ShareList WebDAV"

    this.allows = ['GET','PUT','HEAD','OPTIONS','PROPFIND']

    this.files = files
  }
  _urlencode(v){
    return decodeURIComponent(v)
  }

  _get_auth(){
    let authorization = this.ctx.get('authorization')
    let [ , value] = authorization.split(' ');
    let pairs = Buffer.from(value, "base64").toString("utf8").split(':')
    return pairs
  }

  /**
   * check authentication if check is implemented
   * 
   * @param  void
   * @return bool  true if authentication succeded or not necessary
   */
  _check_auth() {
    const ctx = this.ctx
    let auth_type = ctx.get("AUTH_TYPE") || null
    
    if( auth_type ){
      let [auth_user , auth_pw ] = this._get_auth()

      return true
    }else{
      return false
    }
    
  }

  async serveRequest(ctx , next , data){
    this.ctx = ctx
    this.data = data

    // default uri is the complete request uri
    let uri = ctx.protocol + "://" + ctx.hostname + ctx.pathname
    let path_info = ctx.params.path
    // just in case the path came in empty ...
    if (path_info == '') {
      path_info = "/"
    }

    this.base_uri = this.uri = uri
    // this.uri      = $uri + $path_info;

    // set path
    this.path = decodeURIComponent(path_info)

    if (!this.path) {
        if (ctx.method == "GET") {
            // redirect clients that try to GET a collection
            // WebDAV clients should never try this while
            // regular HTTP clients might ...
            this.setHeader("Location: "+$this.base_uri+"/")
            return
        } else {
            // if a WebDAV client didn't give a path we just assume '/'
            this.path = "/"
        }
    } 
    
    //magic_quotes_gpc
    // this.path = this.stripslashes(this.path)
    

    this.setHeader("X-Dav-Powered-By" , this.davPoweredBy || 'ShareList')
    

    // check authentication except options

    if ( !(ctx.method == 'OPTIONS' && this.path == "/") 
         && (this._check_auth())) {
        // RFC2518 says we must use Digest instead of Basic
        // but Microsoft Clients do not support Digest
        // and we don't support NTLM and Kerberos
        // so we are stuck with Basic here
        this.setHeader(`WWW-Authenticate: Basic realm="${this.httpAuthRealm}"`)

        // Windows seems to require this being the last header sent
        // (changed according to PECL bug #3138)
        this.http_status('401 Unauthorized')

        return
    }
  
    
    // detect requested method names
    let method  = this.ctx.method.toLowerCase()

    let wrapperFn = "http_"+method;
    
    // activate HEAD emulation by GET if no HEAD method found
    if (method == "head" && !this.head) {
      method = "get"
    }

    if (
      this[wrapperFn] 
      /* && (method == "options" || this.allows.includes(method))*/
    ) {
      await this[wrapperFn]()
    } 
    else { // method not found/implemented
        if (this.ctx.method == "LOCK") {
          this.http_status("412 Precondition failed")
        } 
        else {
          this.http_status("405 Method not allowed")
          this.setHeader("Allow", this.allows.join(', '));  // tell client what's allowed
        }
    }
  }


  checkAuth(type, username, password){ }


  setHeader(k , v){
    this.ctx.set(k , v)
  }

  setBody(body){
    this.ctx.type = 'text/xml; charset="utf-8"'
    this.ctx.body = body
  }

  setStatus(code){
    this.ctx.status = parseInt(code)
  }

  http_status(status) {
    // simplified success case
    if (status === true) {
      status = "200 OK"
    }
    let statusCode = status.split(' ')[0]
    this._http_status = status
    this.setStatus(statusCode)
    // this.setHeader('X-WebDAV-Status',status)
  }

  http_options(){
    // Microsoft clients default to the Frontpage protocol 
    // unless we tell them to use WebDAV
    this.setHeader("MS-Author-Via: DAV")

    // get allowed methods
    const allows = this.allows

    // dav header
    // assume we are always dav class 1 compliant
    let dav = [1]

    if (allow.includes('LOCK')) {
      // dav class 2 requires that locking is supported 
      dav.push(2)
    }

    // tell clients what we found
    this.http_status("200 OK");
    this.setHeader("DAV: " + dav.join(', '))
    this.setHeader("Allow: " + allows.join(', '))
    this.setHeader("Content-length: 0");
  }

  /**
   * PROPFIND method handler
   *
   * @param  void
   * @return void
   */
  async http_propfind() {
    const ctx = this.ctx

    let options = {
      path : this.path
    }

    // search depth from header (default is "infinity)
    if (ctx.get('HTTP_DEPTH')) {
      options["depth"] = ctx.get('HTTP_DEPTH')
    } else {
      options["depth"] = "infinity"
    }       

    let props = propsParse( ctx.request.body.json )
    
    options['props'] = props

 
    // 输出 
    
    let path = this.path

    let body = `<?xml version="1.0" encoding="utf-8"?>`
        body +=`<D:multistatus xmlns:D="DAV:">`

    const files = this.data.children

    if (files.length == 0) {
      this.http_status("404 Not Found");
      return;
    }
    
    files.forEach( file => {
      let href = this.ctx.origin + this.ctx.path +'/' + encodeURIComponent(file.name)
      let res = propsCreate(file , props)
      body += `
        <D:response>
          <D:href>${href}</D:href>
          <D:propstat>
            <D:status>HTTP/1.1 200 OK</D:status>
            <D:prop xmlns:R="http://ns.example.com/boxschema/">${res}</D:prop>
          </D:propstat>
        </D:response>`
    })

    body +=`</D:multistatus>`
    this.http_status("207 Multi-Status")
    this.setBody( body )
  }


  /**
   * COPY method handler
   *
   * @param  void
   * @return void
   */
  async http_get() {
    let data = this.data

    let url = data.url
    
    if(data.outputType === 'file'){
      sendFile(this.ctx, url)
    }
    else{
      let headers = data.headers || {}
      await sendHTTPFile(this.ctx , url ,headers)

    }

  }

  /**
   * HEAD method handler
   *
   * @param  void
   * @return void
   */
  http_head() {
    
  }
}

module.exports = new WebDAV()