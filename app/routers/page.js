/**
 * 主页子路由
 */

const router = require('koa-router')()
const sharelist = require('../controllers/sharelist')

const routers = router
  .get('/:path(.*)', sharelist.index)
 
module.exports = routers
