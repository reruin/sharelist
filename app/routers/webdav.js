const router = require('koa-router')()
const webdav = require('../controllers/webdav')


const routers = router.all(':path(.*)' , webdav)
 
module.exports = routers
