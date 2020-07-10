const parseXML = require('xml2js').parseString
const parsePath = require('../utils/base').parsePath
const { setLocation , getConfig , setRuntime , checkAccess } = require('../config')
const qs = require('querystring')
const { URLSearchParams } = require('url')

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

const guessWebDAV = (ua) => {
  return /(Microsoft\-WebDAV|FileExplorer|WinSCP|WebDAVLib|WebDAVFS|rclone)/i.test(ua)
}

const webdavMethods = ['options','head','trace','get','put','post','delete','mkcol','propfind','proppatch','copy','move','lock','unlock']

const parseConfig = (str) => {
  let params = new URLSearchParams(str)
  let ret = {}
  if(params.has('preview')){
    ret.isPreview = true
  }
  if(params.has('forward')){
    ret.isForward = true
  }
  if(params.has('sort')){
    let s = params.get('sort')
    let r = {}
    for(let i of s.split('+')){
      let pairs = i.split(':')
      if(pairs.length == 2){
        r[pairs[0]] = pairs[1]
      }
    }
    ret.sort = r
  }
  return ret
}
module.exports = async(ctx, next) => {
  if (!ctx.session.access) {
    ctx.session.access = new Set()
  }

  let { path , method } = ctx
  let webdavPath = (getConfig('webdav_path') + '/').replace(/\/+$/,'')
  let isWebDAV = path.startsWith(webdavPath)
  let url = path.replace(new RegExp('^'+webdavPath) , '').replace(/\/$/,'')
  let [paths, paths_raw] = parsePath(url)

  ctx.paths = paths
  ctx.paths_raw = paths_raw

  let query = parseConfig(ctx.querystring)
  let isAdmin = !!ctx.session.admin
  //兼容 get 验证
  if( checkAccess(ctx.query.token) ){
    isAdmin = true
  }
  let runtime = {
    href:ctx.href,
    querystring:ctx.querystring,
    query:ctx.query,
    body:ctx.request.body,
    method:ctx.method,
    host:ctx.host,
    origin:ctx.origin,
    protocol:ctx.protocol,
    path:ctx.path,
    paths:paths,
    isAdmin,
    access:ctx.session.access,
    session:ctx.session,
    ...query
  }
  if( ctx.get('x-request') ){
    let data = {}
    try{
      data = JSON.parse(decodeURIComponent(ctx.get('x-request')))
    }catch(e){

    }
    if( data.type == 'upload' ){
      //保持长连接
      ctx.req.socket.setKeepAlive(true)

      runtime.upload = {
        stream:ctx.req ,
        enable:ctx.session.admin || !!getConfig('anonymous_uplod_enable'),
        options:data
      }
    }
  }

  ctx.runtime = runtime
  setRuntime(runtime)
  /*
  setLocation({
    href:ctx.href,
    path:ctx.path,
    query:ctx.query,
    host:ctx.host,
    origin:ctx.origin,
    protocol:ctx.protocol
  })
  */
  
  if(webdavPath == ''){
    isWebDAV = ctx.is('xml') || guessWebDAV(ctx.request.headers['user-agent'])
  }
  if( 
      isWebDAV
      &&
      ( webdavMethods.includes(method.toLowerCase()) )
    ){
    let xml = await parser(ctx.req)

    let json = await xml2js( xml , {
      explicitChildren:true,
      explicitArray:false
    })

    ctx.webdav = {
      data:json , 
      depth:ctx.get('depth')
    }

    ctx.runtime.isWebDAV = true
    //upload
    if(method == 'PUT'){
      //{ type: 'upload', name: file.name, size: file.size , path : opts.path }
      runtime.upload = {
        stream:ctx.req ,
        enable:ctx.session.admin || !!getConfig('anonymous_uplod_enable'),
        options:{ name: ctx.path.split('/').pop() , filepath: ctx.path.replace(webdavPath,'')}
      }
    }

    //webdav 认证状态
    if(!runtime.isAdmin && ctx.get('authorization')){
      let [, value] = ctx.get('authorization').split(' ');
      let pairs = Buffer.from(value, "base64").toString("utf8").split(':')
      if( checkAccess(pairs[1]) ){
        ctx.session.admin = true
        runtime.isAdmin = true
      }
    }
  }
  await next()
}