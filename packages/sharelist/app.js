#!/usr/bin/env node

/**
 * Module dependencies.
 */

const bootstrap = require('./app/main')
const http = require('http')
const os = require('os')
const fs = require('fs')

const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error
  }

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error('Pipe requires elevated privileges')
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error('Port is already in use')
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


bootstrap().then(({ app, port }) => {
  const server = http.createServer(app.callback())
  server.on('error', onError).on('listening', () => {
    console.log(`[${new Date().toISOString()}] Sharelist Server is running at http://` + getIpv4() + ':' + server.address().port + '/')
  })
  server.listen(process.env.PORT || port || 33001)
})
