
const createSharelist = require('./modules/core')
const createWebDAV = require('./modules/webdav')
const createServer = require('./modules/server')
const createGuide = require('./modules/guide')
const config = require('./config')

const bootstrap = async () => {
  const sharelist = await createSharelist(config)

  const server = createServer(sharelist, config)

  server.use(createWebDAV(sharelist))

  server.use(createGuide(sharelist))

  server.start()

  return { app: server.app, port: config.port }
}

module.exports = bootstrap