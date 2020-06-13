const http = require('../utils/http')
const { sendFile, sendHTTPFile } = require('../utils/sendfile')
const { api } = require('./sharelist')
const { getConfig } = require('../config')

const slashify = (p) => (p[p.length - 1] != '/' ? `${p}/` : p)

var virtualFile = {

}

/**
 * Webdav props default options
 */
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

/**
 * Conv date to GMT
 * 
 * @param {string} [d]
 * @return {mixed}
 */
const dateFormat = (d) => {
  let nd = new Date(d)
  if (nd instanceof Date && !isNaN(nd)) {
    return nd.toGMTString()
  } else {
    return null
  }
}

/**
 * Create webdav xml response
 *
 * @param {object} [data]
 * @param {object} [options] 
 * @param {object} [optiosn.props]
 * @param {object} [optiosn.ns]
 * @param {string} [optiosn.ns.name]
 * @param {string} [optiosn.ns.value]
 * @return {string} XML string
 */
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
      out += `<${name}:${key}>${parseInt(data.size || 0)}</${name}:${key}>`
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

/**
 * Parse prop from webdab request
 *
 * @param  {object} [data]
 * @return {object}
 */
const propfindParse = (data, ns) => {
  if(!data){
    return default_options
  }

  let findprop_ns = nsParse(data)
  let method = Object.keys(data)[0].split(':').pop() || 'propfind'

  let fp_ns_name = findprop_ns ? `${findprop_ns.name}:` : ''
  let props = {}
  if(data[`${fp_ns_name}${method}`]['$$'].hasOwnProperty(`${fp_ns_name}allprop`)){
    return default_options
  }
  if(data[`${fp_ns_name}${method}`]['$$'][`${fp_ns_name}prop`]){
    let props_raw = data[`${fp_ns_name}${method}`]['$$'][`${fp_ns_name}prop`]
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

/**
 * Parse props from webdav request
 * 
 * @param {object} [data]
 * @return {object|boolean}
 */
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

/**
 * Create webdav responese xml by data and props options
 *
 * @param {object} [data] file data
 * @param {object} [options]
 * @param {object} [options.props] Available props
 * @param {object} [options.path]  Current folder path
 * @param {object} [options.ns]
 * @return {string} XML string
 */
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
  return body
}

class Request {
  /**
   * Initialize a new Request for WebDAV
   *
   * @param {Object} ctx
   */
  constructor(ctx) {
    this.ctx = ctx
    this.davPoweredBy = null
    this.httpAuthRealm = "ShareList WebDAV"
    this.allows = ['GET', 'PUT', 'HEAD', 'OPTIONS', 'PROPFIND']
  }

  /**
   * Execute handler
   * 
   * @api private
   */
  async exec(){
    let { ctx } = this

    this.path = /*this.ctx.protocol + '://' + this.ctx.host +*/ ctx.path

    this.setHeader("X-Dav-Powered-By", this.davPoweredBy || 'ShareList')

    this.depth = ctx.webdav.depth

    this.incompatibleUserAgents = /(WebDAVFS|Microsoft-WebDAV-MiniRedir)/i.test(ctx.get('user-agent'))

    let method = ctx.method.toLowerCase()

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

  /**
   * Set header
   *
   * @param  {string} [k] key
   * @param  {string} [v] value
   * @return void
   */
  setHeader(k, v) {
    this.ctx.set(k, v)
  }

  /**
   * Set body
   *
   * @param  {mixed} [body] 
   * @return void
   */
  setBody(body) {
    this.ctx.type = 'text/xml; charset="utf-8"'
    this.setHeader('Content-Length', body.length);
    this.ctx.body = body
  }

  /**
   * Set body status
   *
   * @param  {string|boolean} [status] 
   * @return void
   */
  setStatus(status) {
    if (status === true) {
      status = "200 OK"
    }

    let statusCode = status.split(' ')[0]
    this.ctx.status = parseInt(statusCode)
    this.setHeader('X-WebDAV-Status', status)
  }

  /**
   * OPTIONS method
   *
   * @param  void
   * @return void
   */
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
    let options = propfindParse(this.ctx.webdav.data)
    options.path = this.path
    options.depth = this.depth
    const data = await api(this.ctx)
    if(!data){
      this.setStatus("404 Not Found")
      return
    }
    if( data.type == 'auth' ){
      this.setHeader('WWW-Authenticate', `Basic realm="${this.httpAuthRealm}"`)
      // Windows seems to require this being the last header sent
      // (changed according to PECL bug #3138)
      this.setStatus('401 Unauthorized')
      return true
    }


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
          for(let i of files){
            if( virtualFile[i.href] ){
              if( virtualFile[i.href].locked ){
                i['locktype'] = 'write'
              }
            }
          }
          this.setBody(respCreate(files, options))
        }
      }
    } else {
      const files = data.children
      this.setStatus("207 Multi-Status")
      if( this.incompatibleUserAgents ){
        files.unshift({
          type: 'folder', href : this.path , name:data.name || '._'
        })
      }
      this.setBody(respCreate(files, options))
    }
  }


  /**
   * GET method
   *
   * @param  void
   * @return void
   */
  async http_get() {
    await api(this.ctx)
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

const webdav = async (ctx , next) => {
  let req = new Request(ctx)
  return await req.exec()
}

module.exports = webdav
