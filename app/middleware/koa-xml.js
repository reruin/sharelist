const parseXML = require('xml2js').parseString

const parser = (req, options) => {
  return new Promise((resolve, reject) => {
    let xml = '';
    req.on('data', chunk => xml += chunk.toString('utf-8'))
    .on('error', reject)
    .on('end', () => resolve(xml))
  })
}

const xml2js = ( xml , options ) => {
  return new Promise((resolve , reject) => {
    parseXML(xml, options, (err, res) => {
      if (err) throw err
      resolve(res)
    })
  })
}
module.exports = ({methods , ...rest} = {}) => {
  methods = methods || []
  return async(ctx, next) => {
    if (
      ctx.is('xml') &&
      ( methods.length == 0 || methods.includes(ctx.method) )
    ) {
      let xml = await parser(ctx.req)
      let json = await xml2js( xml , rest)
      ctx.request.body = { xml  , json}
    }
    await next()
  }
}