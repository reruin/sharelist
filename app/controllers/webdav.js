const webdav = require('../utils/webDAV')
const sharelist = require('./sharelist')

module.exports = async (ctx , next) => {
  console.log('---> method:',ctx.method)

  let data = await sharelist.api(ctx.path.split('/').slice(1).join('/') , ctx.paths.slice(1), ctx.query)
  await webdav.serveRequest(ctx , next , data)
}