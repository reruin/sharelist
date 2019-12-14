const router = require('koa-router')()

const page = require('./page')

const manage = require('./manage')

const install = require('./install')

// const api = require('./api')

const installMid = require('../middleware/koa-install')

router.use('/manage',installMid,manage.routes(), manage.allowedMethods())

// router.use('/api',installMid,api.routes(), api.allowedMethods())

router.use('/install',install.routes(), install.allowedMethods())

// router.use('/webdav',webdav.routes(), webdav.allowedMethods())

router.use(installMid, page.routes(), page.allowedMethods())


module.exports = router