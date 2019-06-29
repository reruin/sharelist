const fs = require('fs')
const os = require('os')
const { createFiledb } = require('./utils/db/filedb');
const configPath = process.cwd() +'/cache/config.json'
const port = process.env.PORT || 33001
const runtime = {}

const db = createFiledb(configPath , {raw:true} , {
  port , 

  proxy_enable : 0 ,

  preview_enable : 1,

  webdav_path : '/webdav/',
  //目录刷新时间 15分钟
  max_age_dir: 15 * 60 * 1000,
  //外链 10分钟
  max_age_file: 5 * 60 * 1000,

  skin:'default'
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

const getSkin = (key) => {
  return db.get('skin') || 'default'
}

const setRuntime = (key , value) => {
  runtime[key] = value
}

const saveDrive = (value) => {
  const name = runtime.req.path.replace(/^\//g,'')
  const path = getPath()
  console.log('save' , name , value)
  let hit = path.find( i => i.name == name)
  if(hit){
    hit.path = value
    db.save(path)
  }
}

const getDrive = () => {
  const name = runtime.req.path.replace(/^\//g,'')
  const path = getPath()
  const hit = path.find( i => i.name == name)
  if(hit){
    return hit.path
  }else{
    return false
  }
}

module.exports = { getConfig , getAllConfig, save , installed , getPath , setRuntime , getRuntime , saveDrive , getDrive , getSkin }