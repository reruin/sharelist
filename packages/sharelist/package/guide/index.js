const baidu = require('./driver/baidu')
const onedrive = require('./driver/onedrive')
const googledrive = require('./driver/googledrive')
const aliyundrive = require('./driver/aliyundrive')

module.exports = (app) => {
  const vendor = { app, onedrive, googledrive, baidu, aliyundrive }
  app.router
    .all('/@guide/:type', async (ctx, next) => {
      await vendor[ctx.params.type]?.(ctx, next)
    })
    .get('/@guide/:type/:pairs(.*)/callback', async (ctx, next) => {
      await vendor[ctx.params.type]?.(ctx, next)
    })

  app.addSingleton('guide', async (options) => {
    let guide = {}
    for (let i in vendor) {
      guide[i] = `/@guide/${i}`
    }
    return guide
  })
}
