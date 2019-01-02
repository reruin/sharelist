const fs = require('fs')
const os = require('os')
const config_path = process.cwd() +'/cache/config.json'
const port = process.env.PORT || 33001

var location = {}

var data = {
  port , 

  proxy_enable : 0 ,

  //目录刷新时间 15分钟
  max_age_dir: 15 * 60 * 1000,
  //外链 10分钟
  max_age_file: 5 * 60 * 1000
}

const save = async (d) => {

  for(var i in d){
    data[i] = d[i]
  }

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

const installed = () => data.token && data.path

const getTitle = () => data.title || 'ShareList'

const getConfig = () => ({proxy_enable:data.proxy_enable , max_age_dir:data.max_age_dir , max_age_file:data.max_age_file})

const getToken = () => data.token

const getAllConfig = () => ({...data})

const getPort = () => data.port

const getPath = () => [].concat( data.path || [] )

const setLocation = (d) => { location = d }

const getLocation = () => location

const setConfig = (d) => {
  
} 

try{
  let cfg = fs.readFileSync(config_path,'utf-8');  
  if(cfg){
    cfg = JSON.parse(cfg)
    for(var i in cfg){
      data[i] = cfg[i]
    }
  }
  console.log('Load config from file')
}catch(e){

}

module.exports = { get:getAllConfig, getConfig , getToken , getPath , getPort , getTitle , save , installed , getLocation , setLocation}