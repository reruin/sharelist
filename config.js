const fs = require('fs')
const os = require('os')
const config_path = process.cwd() +'/cache/config.json'
const port = process.env.PORT || 33001

var data = {port}

try{
  var cfg =fs.readFileSync(config_path,'utf-8');  
  if(cfg){
    data = JSON.parse(cfg)
  }
  console.log('Load config from file')
}catch(e){

}

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
 data, save , installed , port
}