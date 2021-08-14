const baidu = require('./driver/baidu')
const onedrive = require('./driver/onedrive')
const googledrive = require('./driver/googledrive')
const aliyundrive = require('./driver/aliyundrive')

module.exports = (app) => {
  const vendor = { onedrive, googledrive, baidu, aliyundrive }
  app.router
    .all('/@guide/:type', (ctx, next) => {
      vendor[ctx.params.type]?.call({ app }, ctx, next)
    })
    .get('/@guide/:type/:pairs(.*)/callback', (ctx, next) => {
      vendor[ctx.params.type]?.call({ app }, ctx, next)
    })

  app.addSingleton('guide', async (options) => {
    let guide = {}
    for (let i in vendor) {
      guide[i] = `/@guide/${i}`
    }
    return guide
  })
}
