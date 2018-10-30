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

module.exports = () => {
  const methods = ['pptions','head','trace','get','put','post','delete','mkcol','propfind','proppatch','copy','move','lock','unlock']

  return async(ctx, next) => {
    console.log( ctx.request )
    if (
      ctx.is('xml') &&
      ( methods.length == 0 || methods.includes(ctx.method.toLowerCase()) )
    ) {
      let xml = await parser(ctx.req)
      let json = await xml2js( xml )
      ctx.webdav = json
    }
    await next()
  }
}