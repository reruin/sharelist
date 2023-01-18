const { URL } = require('url')

const utils = require('./utils')

const createDriver = require('./driver')

const actionFactory = require('./action')

const request = require('./request')

const { createRectifier, streamReader, createChunkStream } = require('./rectifier')

const { isFunction, isClass, createCache } = utils

const plugins = []

const DRIVE_KEY = Symbol('drive_key')

const error = (error) => {
  console.trace(error)
  throw error
}


const isSameDrive = async (src, dest) => {
  let a = decode(src), b = decode(dest)
  return a.protocol === b.protocol && a.key === b.key
}

const decode = (p) => {
  let hasProtocol = p.includes('://')
  if (!hasProtocol) p = 'sharelist://' + p
  let data = new URL(p)
  let protocol = data.protocol.replace(':', '')

  let result = {
    protocol,
    key: data.host,
    path: decodeURIComponent(data.pathname || ''),
  }

  if (result.path) result.path = result.path.replace(/^\/+/, '')
  if (hasProtocol) result.protocol = data.protocol.split(':')[0]

  if (!result.path) result.path = undefined
  return result
}

const deduceConfig = (drive) => {
  return {
    readonly: !drive.upload
  }
}
const createSingleton = (plugin, inject) => {
  let { module, protocol } = plugin

  return {
    id: protocol,

    name: protocol,

    config: {},

    configHash: '',

    encode: path => path,

    decode: path => path,

    drive: new module(inject),

    isRoot: () => true
  }
}

exports.createPluginLoader = async (options) => {

  const config = options.config || {}

  const cache = options.cache || createCache()

  //save index of driver in plugins array
  const driversMap = new Map()

  const loadDrives = (plugin, inject, override = false) => {
    let { module, protocol, options } = plugin

    const drivesConfig = config.drives.filter(i => i.protocol === protocol)

    const keyProp = options.key

    const defaultRoot = options.defaultRoot

    const activeDrives = []

    drivesConfig.forEach(({ name, config, id }) => {

      let configHash = utils.hash(JSON.stringify(config))

      let driveIndex = plugin.drives.findIndex(i => i.id == id)

      activeDrives.push(id)

      // if config has not changed OR driver has not changed.
      if (driveIndex >= 0 && plugin.drives[driveIndex].configHash == configHash && !override) {
        return
      }

      console.log('  - mount: ' + id)

      //privacy
      let getKey = () => {
        return utils.hash('sharelist_' + (config[DRIVE_KEY] || (keyProp ? config[keyProp] : id) || protocol))
      }

      let configer = {
        get() {
          return { ...config }
        },
        set(data) {
          for (let i in data) {
            config[i] = data[i]
          }
        }
      }

      const drive = new module(inject, config)
      // inject
      if (!drive.isRoot) {
        drive.isRoot = function (path) {
          return (config.root_id || defaultRoot) === path
        }
      }

      const driveMeta = {
        id,

        // drive name (the disk name set by user)
        name,

        // Each drive has its unique ID, but it's not suitable for use as cache ID.
        // Because they may use the same configuration.
        // so it MUST be provide a another key for driver plugin. 
        getKey,

        // drive config
        config,

        // drive config hash
        configHash,

        // uri encode
        encode: (path) => {
          let pathname = path === undefined || path === '' ? '/' : '/' + path
          let ret = `${protocol}://${getKey() || ''}${pathname}`
          return ret
        },

        // drive instance
        drive
        // drive: classMode ? new module(sharelist, drive.config) : module.call(module, sharelist, drive.config)
      }

      // update/create
      if (driveIndex >= 0) {
        plugin.drives[driveIndex] = driveMeta
      } else {
        plugin.drives.push(driveMeta)
      }

    })

    //remove others
    for (let i = plugin.drives.length; i--;) {
      if (!activeDrives.includes(plugin.drives[i].id)) {
        console.log('  - unmount: ' + plugin.drives[i].id)
        plugin.drives[i].drive?.destroy?.()

        plugin.drives[i].drive = null
        plugin.drives[i].encode = null
        plugin.drives[i].getKey = null
        plugin.drives.splice(i, 1)
      }
    }

    // driver.drives = driver.drives.filter(i => existDrives.includes(i.id))
  }

  /**
   * 获取指定协议的挂载驱动
   */
  const getDriver = (protocol) => {
    if (protocol) {
      let idx = driversMap.get(protocol)
      if (idx !== undefined) {
        return plugins[idx]
      }
    } else {
      return plugins.filter(i => i.isDriver).map(i => ({
        name: i.name,
        protocol: i.protocol,
        guide: i.options.guide,
        mountable: i.options.mountable !== false
      }))
    }
  }

  /**
   * 根据URI获取磁盘元信息
   */
  const getDrive = async (uri) => {
    let { protocol, key, path } = decode(uri)

    let plugin = getDriver(protocol)

    if (!plugin) return {}

    let hit = plugin.singleton || plugin?.drives?.find(i => i.getKey() == key)

    if (!hit) return {}

    if (hit.decode) {
      path = hit.decode(uri)
    }

    let config = Object.assign(deduceConfig(hit.drive), plugin.options || {}, await hit?.drive?.getOptions?.() || {})

    return {
      name: hit.name,
      drive: hit.drive,
      config,
      id: path || plugin.options?.defaultRoot,
      encode: hit.encode,
      protocol,
      isRoot: hit.isRoot
    }
  }

  const getRoot = async ({ orderBy } = {}) => {
    const disk = []
    for (let i of config.drives) {
      let { id, protocol, name, config } = i
      let plugin = getDriver(protocol)
      let hit = plugin?.drives?.find(i => i.id == id)
      // sources 和 drive 未做区分

      if (hit) {
        let config = Object.assign({}, plugin.options || {}, await hit?.drive?.getOptions?.() || {})

        disk.push({
          id: hit.encode(config.root_id || plugin.options?.defaultRoot),//protocol + '://' + drive.getKey(),
          name: name,
          size: 0,
          mtime: '',
          ctime: '',
          type: 'drive',
          config,
          extra: {
            config_id: id,
          }
        })
      }
    }


    if (orderBy?.[0] == 'name') {
      let aVal = orderBy[1] ? 1 : -1
      let bVal = aVal == 1 ? -1 : 1
      disk.sort((a, b) => a.name > b.name ? aVal : bVal)
    }

    return { id: 'root:', type: 'drive', name: '', files: disk, config: { pagination: false, search: false, isRoot: true } }
  }

  // load plugin
  const load = async (newPlugins, override = false) => {
    if (!Array.isArray(newPlugins)) {
      newPlugins = [newPlugins]
    }
    // preprocessing: 
    // plugins with the same name will be overwrittenexcept for drivers which differentiated by protocol.

    let validPlugins = []

    for (let { name, module, hash } of newPlugins) {
      if (plugins.find(i => i.hash == hash)) {
        continue
      }

      if (isFunction(module)) {
        module = module(inject)
      }

      // plugin upgrade/downgrade
      let { driver, ...pluginData } = module

      pluginData.name = name
      pluginData.hash = hash

      if (!!driver) {

        let options = driver.options
        let idx = validPlugins.findIndex(i => i.protocol == options.protocol)
        pluginData.isDriver = true
        pluginData.options = options
        pluginData.drives = []
        pluginData.protocol = options.protocol
        pluginData.module = driver

        if (idx >= 0) {
          validPlugins.splice(idx, 1)
        }
      }

      validPlugins.push(pluginData)
    }

    for (let plugin of validPlugins) {
      let { hash, isDriver } = plugin

      if (isDriver) {
        const protocol = plugin.protocol

        // driver must be update when: 
        // 1. exist plugins that handle the same protocol.
        // 2. plugin content has been changed.

        let existPlugin = getDriver(protocol)
        const isDriverUpdated = !existPlugin || existPlugin.hash != hash


        if (isDriverUpdated) {
          console.log('load driver ' + protocol, plugins.length)
          driversMap.set(protocol, plugins.length)
        }
        //singleton
        if (plugin.options.singleton) {
          console.log('  - mount: singleton')
          plugin.singleton = createSingleton(plugin, inject)
        } else {
          loadDrives(plugin, inject, isDriverUpdated)
        }
      } else {
        let existIndex = plugins.findIndex(i => i.name === plugin.name && !i.isDriver)
        if (existIndex >= 0) {
          plugins.splice(existIndex, 1)
        }
      }

      plugins.push(plugin)

    }

  }

  const unload = (hashes) => {

    for (let i = plugins.length; i--;) {
      let plugin = plugins[i]
      let { hash } = plugin
      if (!hashes.includes(hash)) continue

      //driver plugin
      if (plugin.protocol) {

        plugin.drives.forEach(i => {
          console.log('  - unmount drive: ' + i.id)

          i.drive?.destroy?.()
          i.drive = null
          i.encode = null
          i.getKey = null
        })

        driversMap.delete(plugin.protocol)
      }

      plugins.splice(i, 1)
    }

  }

  const loadConfig = () => {
    driversMap.forEach(i => {
      let plugin = plugins[i]
      if (plugin) {
        loadDrives(plugin, inject)
      }
    })
  }

  const ocr = async (image, type, lang) => {
    if (config.ocr_server) {
      let { data } = await request.post(config.ocr_server, {
        method: 'post',
        contentType: 'json',
        data: { image }
      })
      return { code: data.result }
    }
    return { error: { message: 'ocr server is NOT ready!' } }
  }

  const getPluginConfig = () => {
    const config = plugins.map((i) => i.config ? ({ name: i.name, config: i.config() }) : undefined).filter(Boolean)
    return config
  }

  const emit = async (type, ...rest) => {
    const fns = plugins.map((i) => i[type]).filter(Boolean)

    for (let fn of fns) {
      await fn(...rest)
    }
  }

  const inject = {
    DRIVE_KEY,
    config,
    cache,
    createCache,
    request,
    utils,
    error,
    ocr,
    isSameDrive,
    emit,
    getDriver,
    getDrive,
    getRoot,
    createRectifier,
    streamReader,
    createChunkStream
  }

  //抽象驱动
  const driver = createDriver(inject)

  const createAction = (options) => actionFactory(driver, options)

  inject.driver = driver

  load(options.plugins)

  return {
    ...driver,
    createAction,
    load,
    unload,
    loadConfig,
    getPluginConfig,
    isSameDrive,
    getDriver
  }
}

exports.request = request
