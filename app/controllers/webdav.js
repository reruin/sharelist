const webdav = require('../services/webDAV')
const sharelist = require('./sharelist')

module.exports = async (ctx , next) => {

  let data = await sharelist.api(ctx.path , ctx.paths , ctx.query)
  console.log( '---> webdav : ' + ctx.method  )
  await webdav.serveRequest(ctx , next , data)
}