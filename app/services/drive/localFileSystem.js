/*
 * 提供对本地文件系统的支持
 * id: 完整路径
 */


const name = 'LocalFileSystem'

const version = '1.0'

const protocols = ['ld']

const defaultProvider = 'ld'

const path = require('path')
const fs = require('fs')
const os = require('os')

const isWinOS = os.platform() == 'win32'

//零宽负回顾后发断言
const l2w = (p) => p.replace(/^\/([^\/]+?)/,'$1:\\').replace(/\//g,'\\').replace(/(?<!\:)\\+$/,'').replace(/\\{2,}/g,'\\')

const realpath = (p) => (isWinOS ? l2w(p) : p)

const normalize = (p) => p.replace(/\/{2,}/g,'/').replace(/\/+$/,'')

const extname = (p) => path.extname(p).substring(1)

module.exports = (format) => {

  // const lpath = async(id) => {
  //   let realdir = realpath(normalize(id))
  //   if( fs.existsSync(realdir) ){
  //     let stat = fs.statSync(realpath(path))
  //     if( stat.isDirectory() ){
  //       return folder(id)
  //     }

  //     if( stat.isFile() ){
  //       return file(id)
  //     }
  //   }
  // }

  const folder = async(id) => {
    let dir = normalize(id) , resp = { id : dir , type:'folder', provider:defaultProvider}
    let realdir = realpath(dir)

    if( fs.existsSync(realdir) ){
      let children = []

      fs.readdirSync(realdir).forEach(function(filename){
        let path = normalize(dir + '/' + filename)
        let stat
        try{
          stat = fs.statSync(realpath(path))
        }catch(e){}

        let obj = {
          id:path , 
          name:filename,
          provider:defaultProvider,
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
            obj.ext = extname(filename)
          }
        }
        
        children.push(obj)
      })

      resp.children = children
      return resp
    }else{
      return false
    }
  }

  const file = async(id)=>{
    return {
      id,
      name: path.basename(id),
      ext: extname(id),
      url: realpath(id),
      provider:defaultProvider,
      protocol:'file'
    }
  }

  const source = async(id) => {

  }

  return { name , version , protocols , folder , file }
}