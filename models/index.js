
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const format = require('../utils/format')
const gd = require('./googledrive')
const od = require('./onedrive')

var providers = {gd , od}

const guest_type = (v)=> {
  if(v == '' || v == null){
    return 'folder'
  }
  else if(['mp4' , 'mpeg' , 'wmv' , 'webm' , 'avi' , 'rmvb' , 'mov' , 'mkv','f4v','flv'].indexOf(v) >= 0){
    return 'video'
  }
  else if(['mp3' , 'm4a' ,'wav' , 'ape' , 'flac' , 'ogg'].indexOf(v)>=0){
    return 'audio'
  }
  else if(['doc' , 'docx','ppt','pptx','xls','xlsx','pdf'].indexOf(v)>=0){
    return 'doc'
  }
  else if(['jpg','jpeg','png','gif','bmp','tiff'].indexOf(v) >= 0){
    return 'image'
  }
  else{
    return 'other'
  }
}

// path => folder => files
const path = async(p) => {
  let pl = p.join('.') , hit , resp
  if(cache(pl)){
    hit = cache(pl)
  }
  else{
    if(pl == ''){
      hit = mount()
    }

    else{
      let parent = await path( p.slice(0,-1) )

      let cur = decodeURIComponent(p[p.length - 1])

      if( parent ){
        let hash = base.hash(parent , 'name')
        if(hash[cur]){
          hit = hash[cur]
          cache(pl , hit)
        }else{
          return false
        }
      }else{
        return false
      }
    }
  }
  let provider = providers[hit.provider]
  if(provider){
    // folder /a/b/c
    if( hit.type == 'folder' ){
      resp = await provider.folder(hit.id)
      return resp

      if(cache(hit.id)){
        resp = cache(hit.id)
      }else{
        resp = await provider.folder(hit.id)
        cache(hit.id , resp)
        return resp
      }
    }
    // file  /a/b/c.jpg
    else{
      resp = await provider.file(hit.id , hit.parent)
      resp = { url : resp , type : hit.type , name : hit.name}
    }
  }
  

  return resp
  
}

const mount = () =>{
  let data = config.data , key , provider
  if(Array.isArray( data.path )){
    // 如果只有一个目录 则直接列出
    if(data.path.length == 1){
      key = data.path[0].path.replace(/^.*\:\/\//,'')
      provider = (data.path[0].path.match(/^.*(?=\:\/\/)/) || [''])[0]
    }else{
      //根路径不判断缓存，防止添加路径路径时丢失
      let disk = data.path.map((i,index)=>({
        id : i.path.replace(/^.*\:\/\//,''),
        provider:(i.path.match(/^.*(?=\:\/\/)/) || [''])[0],
        name : i.name,
        size : '-',
        updated_at : '-',
        type : 'folder'
      }))
      cache('root' , disk)
      key = 'root'
      //因为已经缓存 所以任意指定个 provider 即可
      provider = 'gd'
    }

    //设定获取onedrive authkey 的 shareid
    let ods = data.path.filter((i)=>(/^od\:\/\//.test(i.path)))
    if(ods && ods.length){
      cache('$onedrive.authid',ods[0].path.replace('od://',''))
    }
    
  }
  //兼容旧版本
  else{
    key = data.path
    provider = 'gd'
  }
  return {id:key , type:'folder',provider}

}


module.exports = { path }