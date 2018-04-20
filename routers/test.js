/**
 * 主页子路由
 */

const router = require('koa-router')()
const onedirve = require('../controllers/onedrive')

const routers = router
  .get('/', onedirve.index)
 
module.exports = routers
