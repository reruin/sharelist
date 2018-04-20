const router = require('koa-router')()

const page = require('./page')

const manage = require('./manage')

const install = require('./install')

const test = require('./test')


const mid_install = require('../middleware/koa-gdlist-install')

router.use('/manage',mid_install,manage.routes(), manage.allowedMethods())

router.use('/install',install.routes(), install.allowedMethods())

router.use('/onedrive',test.routes(), test.allowedMethods())

router.use(mid_install, page.routes(), page.allowedMethods())

module.exports = router
