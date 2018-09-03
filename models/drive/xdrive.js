/*
 * xdrive 是 sharelist 内置的使用yaml描述的网盘系统 , 没有缓存
 */


const yaml = require('yaml').default
const http = require('../../utils/http')
const base = require('../../utils/base')
const cache = require('../../utils/cache')
const config = require('../../config')
const host = 'https://drive.google.com'
const format = require('../../utils/format')
const source = require('../source')
const adapter = require('../adapter')

/* 递归生成 索引 id */
const createId = (d , rootId)=>{
  d.forEach((i , index)=>{
    if(base.isObject(i)){
      i.id = rootId + '/'+ index
      i.provider = 'xd'

      if(i.children) {
        i.type = 'folder'
        i.provider = 'xd'
        createId(i.children , i.id)
      }else{
        i.ext = i.name.split('.').pop()
        i.type = base.mime_type(i.ext)
      }


      adapter.folder(i)

    }else if(base.isArray(i)){
      createId(i , rootId)
    }
  })
  return d
}

const mount = async(id)=>{
  let resid = 'xd_' + id , resp = {id , type:'folder' , provider:'xd'}
  if(cache(resid)) {
    resp = cache(resid)
    if(
      resp.updated_at && 
      ( Date.now() - resp.updated_at < config.data.cache_refresh_dir)

    ){
      console.log('get xd from cache')
      return resp
    }
  }

  let data = await source(...id.split('@'))

  data = await http.get(data.url)

  let json = yaml.parse( data.body )

  json  = createId(json , id + ':')

  resp.children = json
  resp.updated_at = Date.now()

  cache(resid,resp)

  return resp
}

const findById = (id)=>{
  let rootId = id.split(':')[0]
  let disk = cache(`xd_${rootId}`)
  let path = id.replace(/^[^\/]+\//,'').split('/')

  for(let i=0; i<path.length && disk; i++){
    disk = disk.children
    disk = disk[ parseInt(path[i]) ]
  }

  return disk
}

const folder = async(id) => {
  console.log('id=====>',id)
  let resp
  //xdrive目录内
  if(/@[a-wA-W]+:\//.test(id)){
    return findById(id)
  //挂载xdrive
  }else{
    return mount(id)
  }
  
}

const file = async(id)=>{
  let data = findById(id)
  return data
}

module.exports = {  folder , file }