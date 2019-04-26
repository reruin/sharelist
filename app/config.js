const fs = require('fs')
const os = require('os')
const { createFiledb } = require('./utils/db/filedb');
const configPath = process.cwd() +'/cache/config.json'
const port = process.env.PORT || 33001
const runtime = {}

const db = createFiledb(configPath , {raw:true} , {
  port , 

  proxy_enable : 0 ,

  webdav_path : '/webdav/',
  //目录刷新时间 15分钟
  max_age_dir: 15 * 60 * 1000,
  //外链 10分钟
  max_age_file: 5 * 60 * 1000
});

if(process.env.PORT){
  db.set('port' , port)
}

const save = async (d) => db.set(d)

const installed = () => {
  return db.get('path') && db.get('token')
}

const getConfig = (key) => db.get(key)

const getAllConfig = (key) => db.all

const getPath = () => [].concat( db.get('path') || [] )

const getRuntime = (key) => {
  return runtime[key]
}

const setRuntime = (key , value) => {
  runtime[key] = value
}

module.exports = { getConfig , getAllConfig, save , installed , getPath , setRuntime , getRuntime}