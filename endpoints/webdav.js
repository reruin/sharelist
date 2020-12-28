const parseXML = require('xml2js').parseString

const parser = (req, options) => {
  return new Promise((resolve, reject) => {
    let xml = '';
    req.on('data', chunk => xml += chunk.toString('utf-8'))
    .on('error', reject)
    .on('end', () => resolve(xml))
  })
}

const xml2js = ( xml , options = {}) => {
  return new Promise((resolve , reject) => {
    parseXML(xml, options, (err, res) => {
      if (err) throw err
      resolve(res)
    })
  })
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
  if( name ) name = name + ':'
  for (let key in props) {

    // TODO getlastmodified format: 
    // Mon, 22 Jan 2018 20:03:49 GMT
    // https://tools.ietf.org/html/rfc2616#page-20

    if (key == 'getlastmodified' && data.updated_at) {
      let getlastmodified = dateFormat(data.updated_at)
      if (getlastmodified) {
        out += `<${name}${key}>${getlastmodified}</${name}${key}>`
      }
    }
    if (key == 'displayname') {
      out += `<${name}${key}>${data.name.replace(/&/g,'&amp;').replace(/\</g,'&lt;')}</${name}${key}>`
    }
    if (key == 'getcontentlength') {
      out += `<${name}${key}>${parseInt(data.size || 0)}</${name}${key}>`
    }
    if (key == 'resourcetype') {
      out += `<${name}${key}>${data.type == 'folder' ? `<${name}collection/>` : ''}</${name}${key}>`
    }
    if (key == 'getcontenttype' && data.type != 'folder') {
      out += `<${name}${key}>${data.mime}</${name}${key}>`
    }
    if (key == 'creationdate' && data.created_at) {
      let creationdate = dateFormat(data.created_at)
      if (creationdate) {
        out += `<${name}${key}>${creationdate}</${name}${key}>`
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
  let fp_ns_name = findprop_ns && findprop_ns.name ? `${findprop_ns.name}:` : ''

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
    let hit = attrs.find(i => /xmlns\:?/.test(i))
    if (hit) {
      ns_name = hit.split(':')[1] || ''
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
  let { props, path, basePath = '', ns: { name, value } } = options

  let body = `<?xml version="1.0" encoding="utf-8" ?>`

  let xmlns = name ? `${name}:` : ''
  body += `<${xmlns}multistatus xmlns${name ? (':'+name) : '' }="${value}">`
  data.forEach(file => {
    if (file.hidden !== true) {
      let href = (/*file.href ||*/ (basePath+path+'/'+encodeURIComponent(file.name))).replace(/\/{2,}/g, '/') //path +'/' + encodeURIComponent(file.name)
      //console.log(props)
      let res = propsCreate(file, options)
      body += `<${xmlns}response><${xmlns}href>${href}</${xmlns}href><${xmlns}propstat><${xmlns}status>HTTP/1.1 200 OK</${xmlns}status><${xmlns}prop>${res}</${xmlns}prop></${xmlns}propstat></${xmlns}response>`
    }
  })

  body += `</${xmlns}multistatus>`
  body = body.replace(/^\s+/g,'').replace(/[\r\n]/g,'')
  return body
}

const propfind = async (config,app) => {
  let options = propfindParse(config.data)
  options.path = config.path
  options.depth = config.depth
  options.basePath = config.basePath
  
  let data = await app.command('ls', config.path)
  
  if(!data){
    return {
      status:'404 Not Found'
    }
  }
  if( data.type == 'auth' ){
    // Windows seems to require this being the last header sent
    // (changed according to PECL bug #3138)
    return {
      headers:{
        'WWW-Authenticate':`Basic realm="${this.httpAuthRealm}"`
      },
      status:'401 Unauthorized'
    }
  }


  if (options.depth == '0') {
    if (data.type == 'folder') {
      return {
        status : '207 Multi-Status',
        body: respCreate([{ type: 'folder', href: this.path, name: data.name || 'WebDAVRoot' }], options)
      }
    } else {
      if (data.status == '404') {
        return {
          status:'404 Not Found'
        }
      } else {
        return {
          status : '207 Multi-Status',
          body: respCreate([data], options)
        }
      }
    }
  } else {
    let files = data.children
    //if( incompatibleUserAgents ){
      files.unshift({
        type: 'folder', href : this.path , name:data.name || '._'
      })
    //}
    return {
      status : '207 Multi-Status',
      body: respCreate(files, options)
    }
  }
}

const WebDAVResponse = async (config , app) => {
  const allows = ['GET', 'HEAD', 'OPTIONS', 'PROPFIND']
  const httpAuthRealm = "ShareList WebDAV"

  let { path, method , depth } = config
  console.log('WebDAV',method)
  if( method == 'propfind' ){
    return await propfind(config , app)
  }
  else if( method == 'get' ){
    let data = await app.command('ls', config.path)
    return {
      stream:data
    }
  }
  else if(method == 'options'){
    let dav = [1]

    if (allows.includes('LOCK')) {
      dav.push(2)
    }
    return {
      headers:{
        // For Microsoft clients
        'MS-Author-Via':'DAV',
        'DAV': dav.join(', '),
        'Allow':allows.join(', ')
      },
      status:'200 OK'
    }
  }
  else if( method == 'get'){
    return await get(config,app)
  }else{
    return {
      status:'405 Method not allowed',
      headers:{
        'Allow':allows.join(', ')
      }
    }
  }

}

class WebDAV {
  constructor(app) {
    this.name = 'WebDAVServer'
    this.app = app
    this.path = '/__webdav__'

    this.start()
  }

  start(){
    let { app , path } = this
    let port = app.getConfig('port')

    app.web().use(async (ctx,next) => {
      let url = ctx.req.url
      if(url.startsWith(path)){
        let baseUrl = url.replace(path,'')
        this.app.setRuntime({ origin:'webdav://sharelist' , path: baseUrl})
        await this.onRequest(ctx,next,baseUrl)
      }else{
        await next()
      }
    })

    this.zeroconf = app.bonjour.publish({ name: 'ShareList WebDAV', type: 'webdav', port, txt: { path } })
  }

  async onRequest(ctx,next , url){
    let json = await xml2js(await parser(ctx.req),{
      explicitChildren:true,
      explicitArray:false
    })

    let webdavData = {
      data:json , 
      depth:ctx.get('depth'),
      method:ctx.method.toLowerCase(),
      path: url,
      basePath: this.path,
    }
    let resp
    try{
     resp = await WebDAVResponse(webdavData, this.app)
    }catch(e){
      console.log(e)
    }

    if( resp.headers ){
      ctx.set(resp.headers)
    }
    if( resp.status ){
      let status =  resp.status 
      if (status === true) {
        status = "200 OK"
      }
      let statusCode = status.split(' ')[0]
      ctx.status = parseInt(statusCode)
      ctx.set('X-WebDAV-Status', status)
    }

    if(resp.body){
      ctx.type = 'text/xml; charset="utf-8"'
      ctx.set('Content-Length', resp.body.length)
      ctx.body = resp.body
    }
    else if(resp.stream){
      this.send(ctx, resp.stream)
    }

  }


  async send(ctx , data) {

    let url = data.url
    //补全 headers ，某些webdav客户端无法正常识别
    data.proxy_headers = {
      // 'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }

    // outputType = { file | redirect | url | stream }
    // ctx , url , protocol , type , data
    let { outputType = 'url' , protocol } = data

    let headers = {}
    //https://www.ietf.org/rfc/rfc4437.txt
    headers['Redirect-Ref'] = ''

    if( outputType == 'file'  || outputType == 'stream' || outputType == 'url'){
      await this.app.sendStream(ctx , url , outputType , protocol , data)
    }
    else if( outputType == 'redirect'){
      ctx.redirect( url )
    }
    else {
      ctx.status = 404
    }
  }

  restart(){
    // if( this.zeroconf ){
    //   this.app.bonjour.unpublish(this.zeroconf)
    //   this.zeroconf = null
    // }
    // this.start()
  }
}

module.exports = WebDAV