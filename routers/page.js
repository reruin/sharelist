/**
 * 主页子路由
 */

const router = require('koa-router')()
const gdlist = require('../controllers/gdlist')

const routers = router
  .get('/:path(.*)', gdlist.index)
 
module.exports = routers
