const path = require('path')

const qs = require('querystring')

const { URL } = require('url')

const utils = require('./utils')

const request = require('./request')

const createDriver = require('./driver')

const { isFunction, isClass, createCache } = utils

const injectFunctions = (sharelist, protocol) => {
  return {
    ...sharelist,
    getDrives() {
      let drives = sharelist.config.drives.filter((i) => i.path && i.path.split(':')[0] == protocol)
      if (drives.length == 1) {
        if (drives.length) {
          return [{ ...drives[0], root: true }]
        }
      }
      return drives
    },
    saveDrive(data, where = {}) {
      if (data.key && Object.keys(where).length == 0) where.key = data.key
      let hit = sharelist.config.drives.find((i) => utils.fit(sharelist.decode(i.path), { protocol, ...where }))
      if (hit) {
        hit.path = sharelist.encode({ ...sharelist.decode(hit.path), ...data, protocol })
        console.log('save', data, hit.path)
      }
    },
    encode(data) {
      return sharelist.encode({ ...data, protocol })
    },
    get runtime() {
      return sharelist.runtime
    },
  }
}

const wrapPlugin = (sharelist, src) => {
  if (isFunction(src.onReady)) {
    src.onReady(injectFunctions(sharelist, src.protocol))
  }
  return src
}

const parsePlugins = (sharelist, files = [], store) => {
  let driverMap = new Map(),
    authMap = {},
    cmdMap = new Map()
  for (let ins of files) {
    if (isClass(ins)) {
      let resources = wrapPlugin(sharelist, new ins(sharelist))
      console.log(`load ${resources.protocol}`)
      driverMap.set(resources.protocol, resources)
    } else if (isFunction(ins)) {
      let resource = ins.call(ins, sharelist, utils)

      // if (resource.auth) {
      //   for (let key in resource.auth) {
      //     authMap[key] = resource.auth[key]
      //   }
      // }

      if (resource?.drive) {
        console.log(`load ${resource.drive.protocol}`)
        driverMap.set(resource.drive.protocol, wrapPlugin(sharelist, resource.drive))
      }

      if (resource?.cmd) {
        for (let key in resource.cmd) {
          cmdMap.set(key, resource.cmd[key])
        }
      }
    }
  }
  store.driverMap = driverMap
  // store.authMap = authMap
  store.cmdMap = cmdMap
}

const compose = (middlewares, context) => {
  return (context) =>
    middlewares.reduceRight(
      (a, b) => () => Promise.resolve(b(context, a)),
      () => { },
    )(context)
}

const chain =
  (fns) =>
    async (...args) => {
      for (let fn of fns) {
        await fn(...args)
      }
    }

module.exports = async (options) => {
  const resources = {}

  const config = options.config || {}

  const cache = options.cache || createCache()

  const lifecycles = {}

  const getDrivers = () => {
    let ret = []
    for (let i of resources.driverMap.values()) {
      if (i.mountable) {
        ret.push({
          name: i.name,
          protocol: i.protocol,
          guide: i.guide,
        })
      }
    }
    return ret
  }

  const getDriver = (protocol) => {
    return resources.driverMap.get(protocol)
  }

  const decode = (p) => {
    let hasProtocol = p.includes('://')
    if (!hasProtocol) p = 'sharelist://' + p

    let data = new URL(p)
    let protocol = data.protocol.replace(':', '')

    if (getDriver(protocol)?.decode) {
      return getDriver(protocol).decode(p)
    }

    let result = {
      key: data.host,
      path: decodeURIComponent(data.pathname || ''),
    }

    if (result.path) result.path = result.path.replace(/^\/+/, '')
    if (hasProtocol) result.protocol = data.protocol.split(':')[0]
    for (const [key, value] of data.searchParams) {
      result[key] = value
    }
    return result
  }

  const encode = (options) => {
    if (getDriver(options.protocol)?.encode) {
      return getDriver(options.protocol).encode(options)
    }

    let { protocol, key, path, ...query } = options
    let pathname = path === undefined || path == '' ? '/' : '/' + path
    let search = qs.stringify(query)
    if (search) search = '?' + search
    let ret = `${key || ''}${pathname}${search}`
    if (protocol) ret = `${protocol}://${ret}`
    return ret
  }

  const bootstrape = async () => {
    parsePlugins(sharelist, options.plugins, resources)
  }

  const reload = async (plugins) => {
    parsePlugins(sharelist, plugins, resources)
  }

  const ocr = async (image, type, lang) => {
    return { error: { message: 'ocr server is NOT ready!' } }
  }

  const useLifetime = (type) => {
    if (!lifecycles[type]) {
      lifecycles[type] = []
    }

    return (cb) => {
      const remove = () => {
        let idx = lifecycles[type].findIndex((i) => i == cb)
        if (idx >= 0) {
          lifecycles[type].splice(idx, 1)
        }
      }

      if (!lifecycles[type].find((i) => i == cb)) {
        lifecycles[type].push(cb)
      }

      return remove
    }
  }

  const hookLifetime = (type) => chain(lifecycles[type])


  const sharelist = {
    config,
    cache,
    request,
    utils,
    ocr: ocr,

    decode,
    encode,
    hookLifetime,
    getDriver,
    onListed: useLifetime('onListed'),
    onGeted: useLifetime('onGeted'),
  }

  const driver = createDriver(sharelist)

  sharelist.driver = driver

  bootstrape()

  return {
    ...driver,
    reload,
    decode,
    encode,
    getDrivers
  }
}
