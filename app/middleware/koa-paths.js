const parseXML = require('xml2js').parseString
const parsePath = require('../utils/base').parsePath
const { setLocation , getConfig , setRuntime } = require('../config')

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
  return /(Microsoft\-WebDAV|FileExplorer|WinSCP|WebDAVLib)/i.test(ua)
}

const webdavMethods = ['options','head','trace','get','put','post','delete','mkcol','propfind','proppatch','copy','move','lock','unlock']

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

  setRuntime('req' , {
    href:ctx.href,
    path:ctx.path,
    query:ctx.query,
    body:ctx.request.body,
    host:ctx.host,
    origin:ctx.origin,
    protocol:ctx.protocol
  })
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
  }
  await next()
}