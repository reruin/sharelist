/**
 * 管理
 */

const router = require('koa-router')()
const manage = require('../controllers/manage')

const routers = router
  .get('/', manage.home)
  .get('/:token', manage.home)
  .post('/:token', manage.update)

 
module.exports = routers