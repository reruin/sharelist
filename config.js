const fs = require('fs')
const os = require('os')
const config_path = process.cwd() +'/cache/config.json'
const port = process.env.PORT || 33001

const providers = [
  {name:'GoogleDrive',code:'gd'},
  {name:'OneDrive',code:'od'},
  {name:'Custom',code:'cu'},
]

//onedrive 链接有效期 10 分钟
var data = {
  port , 

  enabled_proxy : 0 ,
  //目录刷新时间 15分钟
  cache_refresh_dir:15 * 60 * 1000,
  //外链 10分钟
  cache_refresh_file: 5 * 60 * 1000
}

try{
  var cfg =fs.readFileSync(config_path,'utf-8');  
  if(cfg){
    cfg = JSON.parse(cfg)
    for(var i in cfg){
      data[i] = cfg[i]
    }
  }
  console.log('Load config from file')
}catch(e){

}


async function save(d){
  console.log(d)
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

function installed(){
  return data.token && data.path
}

module.exports = {
 data, save , installed , port , providers
}