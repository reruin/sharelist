/**
 * 接口子路由
 */

const router = require('koa-router')()
const sharelist = require('../controllers/sharelist')

const routers = router
  .post('/access', sharelist.auth)
 
module.exports = routers
