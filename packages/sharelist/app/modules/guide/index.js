const baidu = require('./driver/baidu')
const onedrive = require('./driver/onedrive')
const googledrive = require('./driver/googledrive')
const aliyundrive = require('./driver/aliyundrive')

module.exports = (inject) => {
  const vendor = { onedrive, googledrive, baidu, aliyundrive }

  return {
    config() {
      let guide = {}
      for (let i in vendor) {
        guide[i] = `/@guide/${i}`
      }
      return { guide }
    },
    route: [
      {
        method: 'all',
        path: '/@guide/:type',
        flush: 'pre',
        handler: async (ctx, next) => {
          await vendor[ctx.params.type]?.(ctx, next, inject)
        }
      },
      {
        method: 'get',
        path: '/@guide/:type/:pairs(.*)/callback',
        flush: 'pre',
        handler: async (ctx, next) => {
          await vendor[ctx.params.type]?.(ctx, next, inject)
        }
      }
    ]
  }
}
