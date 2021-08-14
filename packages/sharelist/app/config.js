const path = require('path')

const isPkg = process.pkg

const isDev = process.env.NODE_ENV === 'dev'

if (isPkg) {
  require('@koa/cors')
  require('koa-body')
  require('koa-json')
}

const pluginPath = isDev
  ? path.join(process.cwd(), '../sharelist-plugin/lib')
  : isPkg
    ? path.join(process.cwd(), './plugins')
    : null

module.exports = (appInfo) => ({
  middleware: ['cors', 'koaBody', 'json'],

  plugin: ['sharelist', 'guide'],

  sharelist: {
    path: path.join(appInfo.baseDir, './package/sharelist/index.js'),
    client: {
      pluginDir: [path.join(appInfo.baseDir, './plugins'), pluginPath],
      cacheDir: path.join(isPkg ? process.cwd() : appInfo.baseDir, './cache'),
    },
  },
  guide: {
    path: path.join(appInfo.baseDir, './package/guide/index.js'),
    client: {},
  },
  theme: {
    options: {
      dir: path.join(appInfo.baseDir, './theme'),
    },
  },
  cors: {
    package: '@koa/cors',
  },
  koaBody: {
    package: 'koa-body',
  },
  json: {
    package: 'koa-json',
  },
})
