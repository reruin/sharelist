const { loadDir, loadFile, loadUnit } = require('./loader')
const Koa = require('koa')
const path = require('path')
const Router = require('koa-router')
const utils = require('./utils')
const createRequest = require('./request')

class Controller {
  constructor(app, mix) {
    this.app = app
    this.config = app.config

    for (let i in mix) {
      this[i] = mix[i].bind(this)
    }
  }
}

class App extends Koa {
  constructor() {
    super()

    this.appInfo = {
      baseDir: path.join(__dirname, '../../'),
      env: process.pkg ? 'pkg' : process.env.NODE_ENV === 'dev' ? 'dev' : 'prod'
    }

    this.utils = utils

    this.loader = {
      loadToApp: this.loadToApp,
      loadToContext: this.loadToContext,
    }

    this.curl = createRequest(this)

    this.lifecycles = {
      beforeConfigLoad: [],
      configLoaded: [],
      loaded: [],
      ready: [],
    }

    this.init()
  }

  async init() {
    let units = await loadUnit({ path: path.join(this.appInfo.baseDir, 'app') }, null, this.appInfo)

    this.config = units.config

    this.router = Router()

    await this.hookLifeCycle('beforeConfigLoad')

    await this.loadPlugin(units)

    await this.hookLifeCycle('configLoaded')

    await this.loadService(units)

    await this.loadMiddleware(units)

    await this.loadController()

    await this.hookLifeCycle('loaded')

    await this.loadRouter()

    this.use(this.router.routes()).use(this.router.allowedMethods())

    await this.hookLifeCycle('ready')
  }

  async loadPlugin({ config, plugin }) {
    let enabled = config.plugin
    for (let name of enabled) {
      let creator = plugin[name]
      if (creator) {
        if (utils.isClass(creator)) {
          this.setLifeCycle(new creator(this))
        } else if (utils.isFunction) {
          creator(this, this.config[name])
        }
      }
    }
  }

  setLifeCycle(instance, scope) {
    for (let type in this.lifecycles) {
      if (instance[type]) {
        this.lifecycles[type].push(instance[type].bind(scope || instance))
      }
    }
  }

  async loadMiddleware({ config, middleware }) {
    // let appMiddleware = await loadDir(this, 'middleware')
    // let coreMiddleware = utils.each(this.coreMiddleware, (i) => loadFile(i.package))
    // let middlewares = { ...appMiddleware, ...coreMiddleware }
    let enabled = config.middleware
    for (let name of enabled) {
      if (middleware[name]) {
        let options = config[name]
        this.use(middleware[name](options, this))
      } else {
        console.log('miss middleware', name)
      }
    }

    for (let name in middleware) {
      this.middleware[name] = middleware[name]
    }
    // console.log(this.middleware)
  }

  async loadController() {
    this.controller = utils.each(
      await loadDir(path.join(this.appInfo.baseDir, 'app', 'controller')),
      (i) => new Controller(this, i),
    )
  }

  async loadService({ service }) {
    this.service = service
  }

  async loadRouter() {
    loadFile(path.join(this.appInfo.baseDir, 'app', 'router.js'))(this)
  }

  async loadTo(directory) {
    return await loadDir(directory)
  }

  async loadToApp(directory, name, options) {
    this[name] = loadDir(directory, options)
  }

  async loadToContext() { }

  async hookLifeCycle(type) {
    let handlers = this.lifecycles[type]
    for (let handler of handlers) {
      await handler()
    }
    //await Promise.all(handlers.map(handler => handler()))
  }

  addSingleton(name, factory) {
    this.lifecycles.configLoaded.push(async () => {
      this[name] = await factory(this.config[name], this)
    })
  }
}

exports.App = App
