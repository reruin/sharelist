module.exports = app => {
  const { router, controller, middleware } = app;
  const auth = middleware.auth({}, app)

  router
    .get('/api/setting', auth, controller.api.setting)
    .get('/api/configs', controller.api.config)
    .post('/api/setting', auth, controller.api.updateSetting)
    .put('/api/cache/clear', auth, controller.api.clearCache)
    .put('/api/reload', auth, controller.api.reload)

    .post('/api/drive/list', controller.api.list)
    .post('/api/drive/get', controller.api.get)
    .get('/api/drive/get', controller.api.get)

    .get('/api/config/:field', controller.api.configField)
    // .get('/api/drive/download', controller.api.download)

    .get('/api/drive/path', controller.api.list)
    .get('/api/drive/path/:path(.*)', controller.api.list)
    .get('/api/drive/:path\\:file', controller.api.get)

    .get('/:path(.*)', controller.api.page)

}
