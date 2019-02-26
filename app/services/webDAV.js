const http = require('../utils/http')
const { sendFile, sendHTTPFile } = require('../utils/sendfile')

const { auth , api } = require('./sharelist')

const slashify = (p) => (p[p.length - 1] != '/' ? `${p}/` : p)

const default_props = {
  getlastmodified: '',
  getcontentlength: '',
  getcontenttype:'',
  creationdate: '',
  resourcetype: '',
  displayname:''
}

const dateFormat = (d) => {
  let nd = new Date(d)
  if(nd instanceof Date && !isNaN(nd)){
    return nd.toGMTString()
  }else{
    return null
  }
}

const propsCreate = (data, options) => {
  let out = ''
  let { props , ns: { name , value} } = options

  for (let key in props) {

    // TODO getlastmodified format: 
    // Mon, 22 Jan 2018 20:03:49 GMT
    // https://tools.ietf.org/html/rfc2616#page-20

    if (key == 'getlastmodified' && data.updated_at) {
      let getlastmodified = dateFormat(data.updated_at)
      if( getlastmodified ){
        out += `<${name}:${key}>${getlastmodified}</${name}:${key}>`
      }
    }
    if (key == 'displayname') {
      out += `<${name}:${key}>${data.name}</${name}:${key}>`
    }
    if (key == 'getcontentlength') {
      out += `<${name}:${key}>${parseInt(data.size)}</${name}:${key}>`
    }
    if (key == 'resourcetype') {
      out += `<${name}:${key}>${data.type == 'folder' ? '<D:collection/>' : ''}</${name}:${key}>`
    }
    if (key == 'getcontenttype' && data.type != 'folder') {
      out += `<${name}:${key}>${data.mime}</${name}:${key}>`
    }
    if (key == 'creationdate' && data.created_at) {
      let creationdate = dateFormat(data.created_at)
      if( creationdate ){
        out += `<${name}:${key}>${creationdate}</${name}:${key}>`
      }
    }
  }

  return out
}

const propsParse = (data) => {
  if(!data || data['propfind']['allprop']){
    return default_props
  }
  let props = data['propfind']['prop'][0]
  let ret = {}
  for (let prop in props) {
    ret[prop] = props[prop][0]
  }
  // console.log('req:',ret)
  return ret
}

const nsParse = (data) => {
  let def = {
    name:'D',
    value:'DAV:'
  }
  if(data && data['propfind']){
    let ns = Object.keys(data['propfind']['$'])[0]
    if(/xmlns:/.test(ns) ){
      return {
        name: ns.replace('xmlns:',''),
        value: data['propfind']['$'][ns]
      }
    }
    else{
      return def
    } 
  }else{
    return def
  }
}

const respCreate = (data, options) => {
  let { props, path , ns: {name , value} } = options

  let body = `<?xml version="1.0" encoding="utf-8" ?>`
  body += `<${name}:multistatus xmlns:${name}="${value}">`
  data.forEach(file => {
    if (file.hidden !== true) {
      let href = file.href.replace(/\/{2,}/g,'/') //path +'/' + encodeURIComponent(file.name)
      //console.log(props)
      let res = propsCreate(file, options)
      body += `
        <${name}:response>
          <${name}:href>${href}</${name}:href>
          <${name}:propstat>
            <${name}:status>HTTP/1.1 200 OK</${name}:status>
            <${name}:prop>${res}</${name}:prop>
          </${name}:propstat>
        </${name}:response>`
    }
  })

  body += `</${name}:multistatus>`

  return body
}

class WebDAV {
  constructor(ctx) {
    this.path = null
    this.ctx = ctx
    this.davPoweredBy = null
    this.httpAuthRealm = "ShareList WebDAV"

    this.allows = ['GET', 'PUT', 'HEAD', 'OPTIONS', 'PROPFIND']
  }

  getAuthority() {
    let authorization = this.ctx.get('authorization')
    let [, value] = authorization.split(' ');
    let pairs = Buffer.from(value, "base64").toString("utf8").split(':')
    return pairs
  }

  checkAuth() {
    if (this.ctx.get('authorization')) {
      return true
    } else {
      return false
    }
  }

  async serveRequest(ctx, next , data) {
    this.ctx = ctx

    this.data  = data

    this.path = this.ctx.protocol + '://' + this.ctx.host //+ this.ctx.path

    this.setHeader("X-Dav-Powered-By", this.davPoweredBy || 'ShareList')

    this.depth = ctx.webdav.depth

    /*
      //
      if (this.depth == 0) {
        options["depth"] = '0'
      } 
      else if(this.depth == 1){
        options["depth"] = '1'
      }
      else {
        options["depth"] = "infinity"
      }

    */
    let method = this.ctx.method.toLowerCase()

    console.log('==>',ctx.webdav)
    const options = {
      depth : this.depth ,
      ns: nsParse(ctx.webdav.data),
      props:propsParse(ctx.webdav.data)
    }

    const wrapperFn = "http_" + method;

    if (
      this[wrapperFn]
    ) {
      return await this[wrapperFn](options)
    } else {
      this.setStatus("405 Method not allowed")
      this.setHeader("Allow", this.allows.join(', '))
      return false
    }
  }

  async afterRequest(data){
    // require auth
    let reqAuth = data.auth
    let access = true
    if (reqAuth) {
      access = false

      if (this.checkAuth()) {
        let [user, passwd] = this.getAuthority()
        if (await auth(data, user, passwd)) {
          access = true
        }
      }
    }

    if (!access) {
      // RFC2518 says we must use Digest instead of Basic
      // but Microsoft Clients do not support Digest
      // and we don't support NTLM and Kerberos
      // so we are stuck with Basic here
      this.setHeader('WWW-Authenticate', `Basic realm="${this.httpAuthRealm}"`)
      // Windows seems to require this being the last header sent
      // (changed according to PECL bug #3138)
      this.setStatus('401 Unauthorized')
      return
    }

  }

  setHeader(k, v) {
    this.ctx.set(k, v)
  }

  setBody(body) {
    this.ctx.type = 'text/xml; charset="utf-8"'
    this.setHeader('Content-Length', body.length);
    this.ctx.body = body
  }

  setStatus(status) {
    if (status === true) {
      status = "200 OK"
    }

    let statusCode = status.split(' ')[0]
    this.ctx.status = parseInt(statusCode)
    this.setHeader('X-WebDAV-Status', status)
  }

  async http_options() {

    const allows = this.allows

    let dav = [1]

    if (allows.includes('LOCK')) {
      dav.push(2)
    }
    // For Microsoft clients
    this.setHeader("MS-Author-Via", "DAV")

    this.setStatus("200 OK");
    this.setHeader("DAV", dav.join(', '))
    this.setHeader("Allow", allows.join(', '))
  }

  /**
   * PROPFIND method
   *
   * @param  void
   * @return void
   */
  async http_propfind(options) {
    console.log('====>','http_propfind',options)
    if( options.depth == '0'){
      this.setStatus("207 Multi-Status")
      this.setBody(respCreate([{type:'folder',href:'/' , name:'webdav'}], options))
    }else{
      const files = this.data.children
      await this.afterRequest(files)
      if (files.length == 0) {
        this.setStatus("404 Not Found")
      } else {
        this.setStatus("207 Multi-Status")
        this.setBody(respCreate(files, options))
      }
    }

  }


  /**
   * GET method
   *
   * @param  void
   * @return void
   */
  async http_get() {
    let data = this.data
    let url = data.url
    if (data.outputType === 'file') {
      sendFile(this.ctx, url)
    } else {
      await sendHTTPFile(this.ctx, url, data.headers || {})
    }
  }

  /*
  http_head() {}

  http_copy() {}

  http_move() {}

  http_mkcol() {}

  http_delete() {}

  http_proppatch() {}

  http_post() {}

  http_put() {}
  */
}

module.exports = new WebDAV()
