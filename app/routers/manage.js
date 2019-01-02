/**
 * 管理
 */

const router = require('koa-router')()
const manage = require('../controllers/manage')

const routers = router
  .get('/', manage.home)
  .post('/', manage.home)
  .post('/api' , manage.api)
  // .get('/:token', manage.home)
  // .post('/:token', manage.update)

 
module.exports = routers