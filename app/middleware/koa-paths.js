const parseXML = require('xml2js').parseString
const parsePath = require('../utils/base').parsePath

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

const webdavMethods = ['pptions','head','trace','get','put','post','delete','mkcol','propfind','proppatch','copy','move','lock','unlock']

module.exports = async(ctx, next) => {
  if (!ctx.session.access) {
    ctx.session.access = new Set()
  }

  let { path , method } = ctx
  let isWebDAV = path.startsWith('/webdav')
  let url = path.replace(/^\/webdav/ , '').substring(1).replace(/\/$/,'')
  let [paths, paths_raw] = parsePath(url)
  ctx.paths = paths
  ctx.paths_raw = paths_raw
  if (
      ctx.is('xml') && isWebDAV &&
      ( webdavMethods.length == 0 || webdavMethods.includes(method.toLowerCase()) )
  ) {
    let xml = await parser(ctx.req)
    let json = await xml2js( xml )
    ctx.webdav = json
  }

  await next()
}