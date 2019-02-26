const http = require('../utils/http')
const { sendFile, sendHTTPFile } = require('../utils/sendfile')
const { api } = require('./sharelist')
const { auth } = require('../services/sharelist')

const slashify = (p) => (p[p.length - 1] != '/' ? `${p}/` : p)

const default_options = {
  ns:{
    name:'D',
    value:'DAV:'
  },
  props:{
    getlastmodified: '',
    getcontentlength: '',
    getcontenttype: '',
    creationdate: '',
    resourcetype: '',
    displayname: ''
  }
}

const dateFormat = (d) => {
  let nd = new Date(d)
  if (nd instanceof Date && !isNaN(nd)) {
    return nd.toGMTString()
  } else {
    return null
  }
}

const propsCreate = (data, options) => {
  let out = ''
  let { props, ns: { name, value } } = options
  for (let key in props) {

    // TODO getlastmodified format: 
    // Mon, 22 Jan 2018 20:03:49 GMT
    // https://tools.ietf.org/html/rfc2616#page-20

    if (key == 'getlastmodified' && data.updated_at) {
      let getlastmodified = dateFormat(data.updated_at)
      if (getlastmodified) {
        out += `<${name}:${key}>${getlastmodified}</${name}:${key}>`
      }
    }
    if (key == 'displayname') {
      out += `<${name}:${key}>${data.name.replace(/&/g,'&amp;').replace(/\</g,'&lt;')}</${name}:${key}>`
    }
    if (key == 'getcontentlength') {
      out += `<${name}:${key}>${parseInt(data.size)}</${name}:${key}>`
    }
    if (key == 'resourcetype') {
      out += `<${name}:${key}>${data.type == 'folder' ? `<${name}:collection/>` : ''}</${name}:${key}>`
    }
    if (key == 'getcontenttype' && data.type != 'folder') {
      out += `<${name}:${key}>${data.mime}</${name}:${key}>`
    }
    if (key == 'creationdate' && data.created_at) {
      let creationdate = dateFormat(data.created_at)
      if (creationdate) {
        out += `<${name}:${key}>${creationdate}</${name}:${key}>`
      }
    }
  }

  return out
}

const propfindParse = (data, ns) => {
  // console.log('raw',data)
  if(!data){
    return default_options
  }

  let findprop_ns = nsParse(data)
  let fp_ns_name = findprop_ns ? `${findprop_ns.name}:` : ''
  let props = {}
  if(data[`${fp_ns_name}propfind`]['$$'].hasOwnProperty(`${fp_ns_name}allprop`)){
    return default_options
  }

  if(data[`${fp_ns_name}propfind`]['$$'][`${fp_ns_name}prop`]){
    let props_raw = data[`${fp_ns_name}propfind`]['$$'][`${fp_ns_name}prop`]
    let prop_ns = nsParse(props_raw) || findprop_ns
    let prop_ns_name = prop_ns ? `${prop_ns.name}:` : ''
    for (let prop in props_raw['$$']) {
      props[prop.replace(prop_ns_name, '')] = props_raw['$$'][prop]
    }
    return {
      ns:prop_ns,
      props:props
    }
  }
}

const nsParse = (data) => {
  if(!data) return false

  data = Object.values(data)[0]

  if (data['$']) {
    let attrs = Object.keys(data['$']),
      ns_name, ns_val
    let hit = attrs.find(i => /xmlns\:/.test(i))
    if (hit) {
      ns_name = hit.split(':')[1]
      ns_val = data['$'][hit]
      return { name: ns_name, value: ns_val }
    }
  }
  return false
}


const respCreate = (data, options) => {
  let { props, path, ns: { name, value } } = options

  let body = `<?xml version="1.0" encoding="utf-8" ?>`

  let xmlns = name ? `${name}:` : ''
  body += `<${xmlns}multistatus${name ? (' xmlns:'+name+'="'+value+'"') : ''}>`
  data.forEach(file => {
    if (file.hidden !== true) {
      let href = (/*file.href ||*/ (path+'/'+encodeURIComponent(file.name))).replace(/\/{2,}/g, '/') //path +'/' + encodeURIComponent(file.name)
      //console.log(props)
      let res = propsCreate(file, options)
      body += `<${xmlns}response><${xmlns}href>${href}</${xmlns}href><${xmlns}propstat><${xmlns}status>HTTP/1.1 200 OK</${xmlns}status><${xmlns}prop>${res}</${xmlns}prop></${xmlns}propstat></${xmlns}response>`
    }
  })

  body += `</${xmlns}multistatus>`
  body = body.replace(/^\s+/g,'').replace(/[\r\n]/g,'')
  // console.log(body)
  /*return `<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:">
    <D:response>
        <D:href>/%E6%BC%94%E7%A4%BA%E7%9B%AE%E5%BD%95/example/filesystem_windows_disk_c/Users/abcdef</D:href>
        <D:propstat>
            <D:status>HTTP/1.1 200 OK</D:status>
            <D:prop>
                <D:getlastmodified>Mon, 25 Feb 2019 12:20:01 GMT</D:getlastmodified>
                <D:getcontentlength>100</D:getcontentlength>
                <D:creationdate>Mon, 25 Feb 2019 12:20:01 GMT</D:creationdate>
                <D:resourcetype>
                    <D:collection />
                </D:resourcetype>
                <D:displayname>你好</D:displayname>
            </D:prop>
        </D:propstat>
    </D:response>
    <D:response>
        <D:href>/%E6%BC%94%E7%A4%BA%E7%9B%AE%E5%BD%95/example/filesystem_windows_disk_c/Users/abcdef2</D:href>
        <D:propstat>
            <D:status>HTTP/1.1 200 OK</D:status>
            <D:prop>
                <D:getlastmodified>Mon, 25 Feb 2019 12:20:01 GMT</D:getlastmodified>
                <D:getcontentlength>100</D:getcontentlength>
                <D:creationdate>Mon, 25 Feb 2019 12:20:01 GMT</D:creationdate>
                <D:resourcetype>
                    <D:collection />
                </D:resourcetype>
                <D:displayname>你好2</D:displayname>
            </D:prop>
        </D:propstat>
    </D:response>
</D:multistatus>`*/
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

  async serveRequest(ctx, next) {
    this.ctx = ctx

    this.path = /*this.ctx.protocol + '://' + this.ctx.host +*/ this.ctx.path

    this.setHeader("X-Dav-Powered-By", this.davPoweredBy || 'ShareList')

    this.depth = ctx.webdav.depth

    this.incompatibleUserAgents = /(WebDAVFS|Microsoft-WebDAV-MiniRedir)/i.test(ctx.get('user-agent'))

    let method = this.ctx.method.toLowerCase()

    const wrapperFn = "http_" + method;
    if (
      this[wrapperFn]
    ) {
      return await this[wrapperFn]()
    } else {
      this.setStatus("405 Method not allowed")
      this.setHeader("Allow", this.allows.join(', '))
      return false
    }
  }

  async afterRequest(data) {
    return false
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
      return true
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
  async http_propfind() {
    const data = await api(this.ctx)
    let reqAuth = await this.afterRequest(data)
    if (reqAuth) return

    let options = propfindParse(this.ctx.webdav.data)
    options.path = this.path
    options.depth = this.depth


    if (options.depth == '0') {
      if (data.type == 'folder') {
        this.setStatus("207 Multi-Status")
        this.setBody(respCreate([{ type: 'folder', href: this.path, name: data.name || 'WebDAVRoot' }], options))
      } else {
        if (data.status == '404') {
          this.setStatus("404 Not Found")
        } else {
          this.setStatus("207 Multi-Status")
          let files = [data]
          this.setBody(respCreate(files, options))
        }
      }
    } else {
      const files = data.children
      if (files && files.length == 0) {
        this.setStatus("404 Not Found")
      } else {
        this.setStatus("207 Multi-Status")
        if( this.incompatibleUserAgents ){
          files.unshift({
            type: 'folder', href : this.path , name:data.name || '._'
          })
        }
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
    const data = await api(this.ctx)
    const url = data.url
    if (data.outputType === 'file') {
      sendFile(this.ctx, url)
    } else {
      await sendHTTPFile(this.ctx, url, data.headers || {} , data)
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
