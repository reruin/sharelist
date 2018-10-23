
const router = require('koa-router')()
const install = require('../controllers/install')

const routers = router
  .get('/', install.home)
  .post('/', install.save)

module.exports = routers
