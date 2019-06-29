const Koa = require('koa')
const views = require('koa-views')
const json = require('koa-json')
const onerror = require('koa-onerror')
const bodyparser = require('koa-bodyparser')
const logger = require('koa-logger')
const koaStatic = require('koa-static')
const locales = require('koa-locales')
const i18n = require('koa-i18n')
const path = require('path')
const session = require('koa-session-minimal')

const less = require('./middleware/koa-less')
const addr = require('./middleware/koa-addr')
const paths = require('./middleware/koa-paths')
const render = require('./middleware/koa-render')

const routers = require('./routers/index')
const cors = require('@koa/cors')
const config = require('./config')

const pluginLoad = require('./services/plugin').load

// const proxy = require('./utils/proxy')

const app = new Koa()
app.proxy = true
pluginLoad({
  dirs: [__dirname + '/plugins',path.resolve('plugins')],
})

onerror(app)

locales(app, {
  dirs: [path.resolve('locales')],
  defaultLocale: 'zh-CN'
})

app.use(session({
  key: 'USER_SID'
}))

app.use(cors())

app.use(bodyparser({
  enableTypes:['json', 'form', 'text' , 'xml']
}))

app.use(json())

app.use(addr)

app.use(paths)

app.use(render)

// 配置控制台日志中间件
app.use(logger())

//less 中间件
app.use(less(__dirname + '/public'))

// 配置静态资源加载中间件
app.use(koaStatic(__dirname + '/public'))

app.use(async (ctx , next) => {
  ctx.state.__ = ctx.__.bind(ctx)
  ctx.state._config_ = config.getConfig.bind(ctx)
  await next()
})

// 配置服务端模板渲染引擎中间件
app.use(views(__dirname + '/views', {
  extension: 'pug'
}))

// 初始化路由中间件
app.use(routers.routes()).use(routers.allowedMethods())

app.use(async (ctx) => {
  console.log(ctx.error)
  switch (ctx.status) {
    case 404:
      await ctx.render('404');
      break;
  }
})

module.exports = app