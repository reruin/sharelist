const fs = require('fs')
const os = require('os')

const config_path = process.cwd() +'/config.json'

var data = require('../config.json')

var app , handler

async function save(d){
  if(d.token) data.token = d.token
  if(d.path) data.path = d.path

  let str = JSON.stringify( data )

  return new Promise((resolve, reject) => {
    fs.writeFile(config_path, str, function(err) {
      if (err) {
        console.log(err,'save config error')
      } else {
        console.log('save config success')
      }
      resolve(true)
    })
  })
}

function installed(){
  return data.token && data.path
}


module.exports = {
 data, save , installed
}