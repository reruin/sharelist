const path = require('path')

const factory = require('@sharelist/core')

const createCache = require('./cache')

const createConfig = require('./config')

const { watch } = require('./reactivity')

const utils = require('./utils')

const diff = (nv, ov) => {
  let needUpdate = nv.filter((i) => ov.every((j) => j.path != i.path))
  let needRemove = ov.filter((i) => nv.every((j) => j.path != i.path))

  return [needUpdate, needRemove]
}


module.exports = (app) => {
  app.addSingleton('sharelist', async (options) => {
    const config = createConfig(path.join(options.cacheDir, 'config.json'))

    const cache = createCache(path.join(options.cacheDir, 'cache.json'))

    const plugins = Object.values(await app.loadTo(options.pluginDir))

    const driver = await factory({ config, plugins, cache })

    const getDisk = () => {
      return config.drives.map((i) => ({ name: i.name, path: driver.decode(i.path) }))
    }

    const setDisk = (data) => {
      data.forEach((i) => {
        i.path = driver.encode(i.path)
      })
      config.drives = data
    }

    const reload = async () => {
      driver.reload(Object.values(await app.loadTo(options.pluginDir)))
    }

    const instance = {
      config, cache, getDisk, setDisk, ...driver,
    }

    const getFiles = (...rest) => utils.getFiles(instance, ...rest)
    const getFile = (...rest) => utils.getFile(instance, ...rest)

    watch(
      () => config.drives,
      (nv, ov) => {
        let [updateDisk = [], removeDisk = []] = diff(nv, ov)
        reload()
      },
    )

    return {
      ...instance,
      getFiles: getFiles,
      getFile: getFile
    }
  })
}
