const path = require('path')

const fs = require('fs')

const { stat, readdir } = require('fs/promises')

const { isClass, isFunction } = require('./utils')

const loadFile = (filepath) => {
  if (!filepath) return

  //is file
  let isfile = /[\.\:]/i.test(filepath)
  if (isfile && !fs.existsSync(filepath)) {
    return
  }
  let ret
  try {
    ret = require(filepath)
  } catch (e) {
    console.log(e)
  }
  return ret
}

const getDirPath = (dir, basepath) => {
  if (dir.path) {
    return dir.path
  }

  const name = dir.package || dir.name
  const lookupDirs = []

  //app
  lookupDirs.push(path.join(basepath, 'node_modules'))

  lookupDirs.push(path.join(process.cwd(), 'node_modules'))
  for (let dir of lookupDirs) {
    dir = path.join(dir, name)
    if (fs.existsSync(dir)) {
      return fs.realpathSync(dir)
    }
  }

  throw new Error(`Can not find plugin ${name} in "${lookupDirs.join(', ')}"`)
}

const loadDir = async (dir) => {
  if (Array.isArray(dir)) {
    let ret = {}
    for (let i of dir) {
      if (i) {
        ret = Object.assign(ret, await loadDir(i))
      }
    }
    return ret
  } else {
    let ret = {}
    if (fs.existsSync(dir)) {
      let files = await readdir(dir)
      for (let i of files) {
        let filepath = path.join(dir, i)
        let file = fs.statSync(filepath)

        if (file.isFile() && i.endsWith('.js')) {
          let instance = loadFile(filepath)
          let name = path.basename(i, '.js')
          ret[name] = instance
        } else if (file.isDirectory()) {
          //let name = path.basename(i)
          //ret[name] = await loadDir(app,path.join(mod,i))
        }
      }
    }
    return ret
  }
}

const loadUnit = async (dir, basepath, appInfo) => {
  if (dir.path) basepath = dir.path

  let dirpath = getDirPath(dir, basepath)

  let middleware = await loadDir(path.join(dirpath, 'middleware'))

  let service = await loadDir(path.join(dirpath, 'service'))

  // let plugins = loadFile(path.join(dirpath, 'plugin.js'))

  let plugin = {}, config = {}

  // load config
  let app = loadFile(path.join(dirpath, 'config.js'))

  if (isFunction(app)) app = app(appInfo)

  if (app) {
    config.middleware = app.middleware || []
    config.plugin = app.plugin || []

    if (app.middleware) {
      for (let name of app.middleware) {
        if (app[name]) {
          if (app[name].path || app[name].package) {
            middleware[name] = loadFile(app[name].path || app[name].package)
          }
          if (app[name].options) {
            config[name] = app[name].options
          }
        }
      }
    }

    if (app.plugin) {
      for (let name of app.plugin) {
        if (app[name].client) {
          config[name] = app[name].client
        }

        let unit = await loadUnit(app[name], dirpath, appInfo)

        Object.assign(middleware, unit.middleware)
        Object.assign(config, unit.config)
        Object.assign(plugin, unit.plugin)

        plugin[name] = loadFile(app[name].path ? path.join(app[name].path) : app[name].package)
        service[name] = unit.service

        if (unit.config) {
          if (unit.config.middleware) config.middleware.unshift(...unit.config.middleware)
          if (unit.config.plugin) config.plugin.unshift(...unit.config.plugin)
        }
      }
    }
  }
  return { middleware, config, plugin, service }
}

exports.loadDir = loadDir
exports.loadFile = loadFile
exports.loadUnit = loadUnit
