
const createSharelist = require('./modules/core')
const createWebDAV = require('./modules/webdav')
const createServer = require('./modules/server')
const createGuide = require('./modules/guide')
const config = require('./config')
const path = require('path')
const fs = require('fs')

const install = async () => {
  let pluginDir = config.pluginDir
  if (fs.existsSync(pluginDir) == false) {
    fs.mkdirSync(pluginDir, { recursive: true })

    try {
      let plugins = JSON.parse(fs.readFileSync(config.defaultPluginsFile, 'utf-8'))

      for (let i of plugins) {
        console.log(i.name)
        let filename = path.join(pluginDir, `${i.namespace}.js`)
        fs.writeFileSync(filename, i.script)
      }
    } catch (e) {
      console.log('Extract default plugins error:', e)
    }

  }

  fs.mkdirSync(path.join(config.cacheDir, 'theme'), { recursive: true })
}

const bootstrap = async () => {
  await install()

  const sharelist = await createSharelist(config)

  const server = createServer(sharelist, config)

  server.use(createWebDAV(sharelist))

  server.use(createGuide(sharelist))

  server.start()

  return { app: server.app, port: config.port }
}

module.exports = bootstrap