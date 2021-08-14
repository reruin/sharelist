#!/usr/bin/env node

/**
 * Module dependencies.
 */

const app = require('./app/index')
const http = require('http')
const os = require('os')
const fs = require('fs')

const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error
  }

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges')
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error(bind + ' is already in use')
      process.exit(1)
      break
    default:
      throw error
  }
}

const getIpv4 = () => {
  var ifaces = os.networkInterfaces()
  for (var dev in ifaces) {
    for (var i in ifaces[dev]) {
      var details = ifaces[dev][i]
      if (/^\d+\./.test(details.address)) {
        return details.address
      }
    }
  }
}

const onListening = () => {
  console.log(new Date().toISOString())
  console.log('Sharelist Server is running at http://' + getIpv4() + ':' + port + '/')
}

if (!fs.existsSync('./cache')) {
  fs.mkdirSync('./cache')
}

const port = app?.sharelist?.config?.port || 33001

const server = http.createServer(app.callback())
server.on('error', onError).on('listening', onListening)
server.listen(port)
