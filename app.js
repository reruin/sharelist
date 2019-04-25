#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('./app/index')
var http = require('http');
var os = require('os')
var config = require('./app/config')
var fs = require('fs')
if(!fs.existsSync('./cache')){
  fs.mkdirSync('./cache');
}


var port = normalizePort(config.getConfig('port') || 33001);

var server = http.createServer(app.callback());


server.listen(port);
server.on('error', onError);
server.on('listening', onListening);


function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

function getIpv4() {
  var ifaces = os.networkInterfaces();
  for (var dev in ifaces) {
      for (var i in ifaces[dev]) {
          var details = ifaces[dev][i];
          if (/^\d+\./.test(details.address)) {
              return details.address;
          }
      }
  }
}

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}


function onListening() {
  console.log(new Date().toISOString())
  console.log('App is running at http://'+getIpv4()+':'+port+'/')
}