const router = require('koa-router')()

const page = require('./page')

const manage = require('./manage')

const install = require('./install')

const api = require('./api')

const webdav = require('./webdav')

const mid_install = require('../middleware/koa-sharelist-install')

router.use('/manage',mid_install,manage.routes(), manage.allowedMethods())

router.use('/api',mid_install,api.routes(), api.allowedMethods())


router.use('/install',install.routes(), install.allowedMethods())

router.use(mid_install, page.routes(), page.allowedMethods())

router.use(webdav.routes(), webdav.allowedMethods())

/*
router.use('/',(ctx) => {
  console.log('method',ctx.method.toLowerCase())
})
*/
module.exports = router
