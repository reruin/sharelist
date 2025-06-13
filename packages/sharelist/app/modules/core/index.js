const path = require('path')

const { nanoid } = require('nanoid')

const { request, createPluginLoader } = require('@sharelist/core')

const createCache = require('./cache')

const { createConfig, defaultConfigKey } = require('./config')

const utils = require('./utils')

const { createPlugin } = require('./plugin')

const createTheme = require('./theme')

const { createTransfer } = require('./task')

module.exports = async (options) => {
  const config = createConfig(path.join(options.cacheDir, 'config.json'))

  const cache = createCache(path.join(options.cacheDir, 'cache.json'))

  const plugin = createPlugin({
    pluginSource: () => config.plugin_source,
    pluginDir: path.join(options.cacheDir, 'plugin'),
    onUpdate(id) {
      //driver has been changed.
      driver.load(plugin.load())
    },
    onRemove(hash) {
      console.log('onremove', hash)
      driver.unload([hash])
    }
  })

  // plugins manager
  const driver = await createPluginLoader({ config, plugins: plugin.load(), cache })

  const theme = createTheme(options.themeDir)

  const transfer = createTransfer(options.cacheDir, driver, request)

  const files = (...rest) => utils.getFiles(driver, config, ...rest)
  const file = (...rest) => utils.getFile(driver, config, ...rest)

  const getDownloadUrl = (...rest) => utils.getDownloadUrl(driver, config, ...rest)
  const getPathById = (...rest) => utils.getPathById(driver, config, ...rest)
  const getContent = (...rest) => driver.createReadStream(...rest)


  const getThemeFile = (file) => theme.getFile(file, config.theme)

  const checkAccess = (token) => config.token && config.token === token

  const reload = async () => {
    await driver.load(plugin.load())
  }

  const setDrives = (data) => {

    for (let i of data) {
      if (!i.id) {
        i.id = nanoid()
      }
    }
    config.drives = data
    driver.loadConfig()

  }

  //if config update/create
  // watch(
  //   () => config.drives,
  //   (nv, ov) => {
  //     console.log('drive config changed')
  //     driver.loadConfig()
  //   },
  // )

  return {
    config,
    cache,
    driver,
    defaultConfigKey,
    plugin,
    theme,
    files,
    file,
    getPathById,
    getContent,
    getDownloadUrl,
    getThemeFile,
    transfer,
    checkAccess,
    request,
    reload,
    setDrives
  }
}
