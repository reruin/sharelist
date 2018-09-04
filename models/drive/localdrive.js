/*
 * 本地硬盘
 */

const base = require('../../utils/base')
const cache = require('../../utils/cache')
const config = require('../../config')
const format = require('../../utils/format')

const path = require('path')
const fs = require('fs')
const adapter = require('../adapter')
const os = require('os')

const isWinOS = os.platform() == 'win32'

const exists = (path) => fs.existsSync( isWinOS ? l2w(path) : path)

const readdir = (path) => fs.readdirSync( isWinOS ? l2w(path) : path )

const fsstat = (path) => fs.statSync( isWinOS ? l2w(path) : path )

const w2l = (p)=>{
  return p.replace(/^([a-z]):\\/,'$1/').replace(/\\/g,'/')
}

const l2w = (p)=>{
  p = p.replace(/^\/([^\/]+?)/,'$1:\\').replace(/\//g,'\\').replace(/\\$/,'').replace(/\\{2,}/g,'\\')
  return p
}

const realpath = (p)=> (isWinOS ? l2w(p) : p)

const normalize = (p) => (p+'/').replace(/\/{2,}/g,'/')

const extname = (p) => path.extname(p).substring(1)

const folder = async(id) => {

  let dir = normalize(id) , resp = { id : dir , type:'folder', provider:'ld'}

  if( exists(dir) ){
    let children = []
    readdir(dir).forEach(function(filename){
      let path = normalize(dir + '/' + filename)
      let stat
      try{
        stat = fsstat(path)
      }catch(e){

      }

      let obj = {
        id:path , 
        name:filename,
        provider:'ld',
        type:'other'
      }

      if(stat){
        obj.size = format.byte(stat.size)
        obj.created_at = format.datetime(stat.ctime)
        obj.updated_at = format.datetime(stat.mtime)
        if(stat.isDirectory()){
          obj.type = 'folder'
        }
        if(stat.isFile()){
          let ext = extname(filename)
          obj.ext = ext

          obj.type = base.mime_type(ext)
          adapter.folder(obj)
        }
      }
      
      children.push(obj)
    })

    resp.children = children
    return resp
  }else{

    return false
  }

  // return resp
}

const file = async(id)=>{

  let name = path.basename(id)
  let ext = extname(id)

  console.log(fs.existsSync(realpath(id)))

  return {
    name , id, fs:true , 
    url: realpath(id),
    type: base.mime_type(ext),
    provider:'ld'
  }
}


module.exports = {  folder , file }