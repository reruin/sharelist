/**
 * 主页子路由
 */

const router = require('koa-router')()
const sharelist = require('../controllers/sharelist')
const webdav = require('../controllers/webdav')

const routers = router
  .all('/:path(.*)', async (ctx, next) => {
    if (ctx.isWebDAV) {
      await webdav(ctx, next)
    } else {
      await sharelist.index(ctx, next)
    }
  })
module.exports = routers
