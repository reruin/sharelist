module.exports = app => {
  const { router, controller, middleware } = app;
  const auth = middleware.auth({}, app)

  router
    .get('/api/setting', auth, controller.api.setting)
    .post('/api/setting', auth, controller.api.updateSetting)
    .get('/api/config', auth, controller.api.config)
    .put('/api/cache/clear', auth, controller.api.clearCache)

    .post('/api/drive/list', controller.api.list)
    .post('/api/drive/get', controller.api.get)
    .get('/api/drive/get', controller.api.get)


    .get('/api/drive/path', controller.api.list)
    .get('/api/drive/path/:path(.*)', controller.api.list)
    .get('/api/drive/:path\\:file', controller.api.get)

    .get('/:path(.*)', controller.api.page)

}
