/*
 * 提供对本地文件系统的支持
 * file:linux风格路径
 */


const name = 'FileSystem'

const version = '1.0'

const protocols = ['fs' , 'file']

const defaultProtocol = 'fs'

const path = require('path')
const fs = require('fs')
const os = require('os')

const isWinOS = os.platform() == 'win32'

const l2w = (p) => p.replace(/^\/([^\/]+?)/,'$1:\\').replace(/\//g,'\\').replace(/(?<!\:)\\+$/,'').replace(/\\{2,}/g,'\\')

const realpath = (p) => (isWinOS ? l2w(p) : p)

const normalize = (p) => p.replace(/\/{2,}/g,'/').replace(/(?<=.+)\/+$/,'')

const extname = (p) => path.extname(p).substring(1)

module.exports = ({datetime}) => {

  const folder = async(id) => {
    let dir = normalize(id) , resp = { id : dir , type:'folder', protocol:defaultProtocol}
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
          protocol:defaultProtocol,
          type:'other'
        }

        if(stat){
          let isFolder = stat.isDirectory()
          obj.created_at = datetime(stat.ctime)
          obj.updated_at = datetime(stat.mtime)
          if(isFolder){
            obj.type = 'folder'
          }
          if(stat.isFile()){
            obj.ext = extname(filename)
            obj.size = stat.size
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
      protocol:defaultProtocol,
      outputType:'file',
      proxy:true
    }
  }

  return { name , version , drive:{ protocols , folder , file } }
}