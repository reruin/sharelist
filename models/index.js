
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const format = require('../utils/format')
const gd = require('./googledrive')
const od = require('./onedrive')
const remote = require('./remote')


class ShareList {
  constructor(root){
    this.providers = {gd , od , remote}
  }

  async path(paths , query , paths_raw){
    let pl = paths.join('/') , hit , resp , miss

    //1. 获取到对象
    /// path -> resid 缓存
    if(cache(pl)){
      if(cache(cache(pl))){
        console.log(`from path(${pl})' -> res`)
        return cache(cache(pl))
      }else{
        cache.clear(pl)
      }
    }

    if(pl == ''){
      hit = this.mount()
    }

    else{
      let parent = await this.path( paths.slice(0,-1) , query , paths_raw)
      let curname = decodeURIComponent(paths[paths.length - 1])
      //父目录必然是 folder
      if( parent ){
        let children = parent.children || []
        let index = base.search(children , 'name' ,  curname)
        if(index != -1){
          hit = children[index]
          //只为目录做缓存
          if(hit.type == 'folder')
            cache(pl , hit.provider+'_'+hit.id)
        }else{
          return false
        }
      }
      //无法完成匹配
      else{
        return false
      }
    }

    //2. 根据对象属性 做下一步操作
    if(hit.provider == 'root'){
      return hit
    }

    let provider = this.providers[hit.provider]
    

    if(provider){
      // folder /a/b/c
      if( hit.type == 'folder' ){
        resp = await provider.folder(hit.id , {query , paths_raw})
        //存在 id 变化 ，例如 OneDrive 的shareid <-> resid
        //重新缓存 path -> resid
        if(hit.id != resp.id){
          cache(pl , hit.provider+'_'+resp.id)
        }
        return resp
      }
      // file  /a/b/c.jpg
      else{
        resp = await provider.file(hit.id , hit)
      }
    }

    return resp
  }


  mount(){
    let paths = config.data.path || [] , key
    let ods = paths.filter((i)=>(/^od\:\/\//.test(i.path)))
    if(ods && ods.length){
      cache('$onedrive.authid',ods[0].path.replace('od://',''))
    }

    // 如果只有一个目录 则直接列出
    if(paths.lengths == 1){
      paths = paths[0].path
      return { 
        id: paths.replace(/^.*\:\/\//,'') , 
        provider : (paths.match(/^.*(?=\:\/\/)/) || [''])[0], 
        type:'folder'
      }
    }else{
      //根路径不判断缓存，防止添加路径路径时丢失
      let disk = paths.map((i,index)=>({
        id : i.path.replace(/^.*\:\/\//,''),
        provider:(i.path.match(/^.*(?=\:\/\/)/) || [''])[0],
        name : i.name,
        size : '-',
        updated_at : '-',
        type : 'folder'
      }))
      
      return {id:'$root' , provider:'root', type:'folder' , children : disk}
    }
  }
}


module.exports = new ShareList()