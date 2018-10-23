
const router = require('koa-router')()
const webdav = require('../utils/webDAV')


const routers = router
  .all(':path(.*)' , (ctx , next) => {
    webdav.serveRequest(ctx , next)
  })
 
module.exports = routers
