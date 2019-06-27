/**
 * 管理
 */

const router = require('koa-router')()
const manage = require('../controllers/manage')

const routers = router
  .get('/', manage.home)
  .post('/', manage.home)
  .post('/api' , manage.api)
  .post('/api/:token', manage.api_token)
  .get('/api/:token', manage.api_token)
  // .post('/:token', manage.update)

 
module.exports = routers