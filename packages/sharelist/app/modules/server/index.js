const Koa = require('koa')
const koaCors = require('@koa/cors')
const koaBody = require('koa-body')
const koaJson = require('koa-json')
const createRouter = require('./router')
const createApi = require('./controller')
const pkg = require('../../../package.json')

class Server {
  constructor(sharelist, appConfig) {
    this.modules = []
    this.sharelist = sharelist
    this.appConfig = appConfig

    const app = new Koa()
    app.use(koaCors())
    app.use(koaBody())
    app.use(koaJson())

    app.use(async (ctx, next) => {
      try {
        await next()
      } catch (error) {
        console.log(error)
        if (error instanceof Error) {
          ctx.body = { error: { message: error.message } }
        } else {
          ctx.body = { error }
        }
      }
    })

    this.app = app
  }

  use(module) {
    this.modules.push(module)
  }

  createConfig() {
    let configs = this.modules.map(i => i.config).filter(Boolean)
    let mergeConfig = { version: pkg.version, ...this.appConfig }
    for (let config of configs) {
      if (typeof config == 'function') {
        config = config(mergeConfig)
      }

      Object.assign(mergeConfig, config)
    }
    return mergeConfig
  }

  start() {
    createRouter(this.app, this.sharelist, createApi(this.sharelist, this.createConfig()), this.modules.map(i => i.route).filter(Boolean).flat())
  }
}

function createServer(...args) {
  return new Server(...args)
}
module.exports = createServer