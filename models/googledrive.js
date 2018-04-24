
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const host = 'https://drive.google.com'
const format = require('../utils/format')

const last_hash = {}

// gd folder => files
const folder = async(id) => {
  let resid = 'gd_' + id , resp = {id , type:'folder' , provider:'gd'}
  if(cache(resid)) {
    resp = cache(resid)

    if(
      resp.updated_at && 
      resp.children &&
      ( Date.now() - resp.updated_at < config.data.cache_refresh_dir)

    ){
      console.log('get gd folder from cache')
      return resp
    }
  }



  let { body } = await http.get(host+'/drive/folders/'+id)
  let code = (body.match(/window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'/) || ['',''])[1]
  let data = code.replace(/\\x22/g,'"').replace(/\\x5b/g,'[').replace(/\\x5d/g,']').replace(/\\(r|n)/g,'')
  if(data){
    data = JSON.parse(data)
    if(data.length){
      data = data[0]
    }
  }
  let children = data ? data.map((i)=>{
    // console.log(i[3],i[44],i[13])
    return base.extend({
      id:i[0],
      name:i[2],
      parent:i[1][0],
      mime:i[3],
      created_at:format.datetime(i[9]),
      updated_at:format.datetime(i[10]),
      size:format.byte(i[13]),
      ext:i[44],
      type : i[13] ? base.mime_type(i[44]) : 'folder',
      provider:'gd'
    } , format.ln(i[2]))
  }) : []


  //folder 额外保存 
  resp.children = children
  resp.updated_at = Date.now()

  cache(resid,resp)
  return resp
}

/**
 * 获取文件实际路径
 */
const file = async(id , data) =>{
  if(
    data && 
    data.url_updated && 
    data.url &&
    ( Date.now() - data.url_updated < config.data.cache_refresh_file)

  ){
    console.log('get gd file from cache')
    return data
  }


  let reallink = ''
  let { body , headers }  = await http.get(host + '/uc?id='+id+'&export=download',{followRedirect : false})
  if(headers && headers.location){
    reallink = headers.location
  }else{
    let url = (body.match(/\/uc\?export=download[^"']+/i) || [''])[0]
    url = url.replace(/&amp;/g,'&')
    let cookie = headers['set-cookie'].join('; ')
    let resp = await http.get(host + url , {headers:{'Cookie':cookie} , followRedirect : false})
    if(resp.headers && resp.headers.location){
      reallink = resp.headers.location
    }
  }

  data.url = reallink
  data.url_updated = Date.now()

  //强制保存 ， data 是指向 父级 的引用
  cache.save()
  return data
}


module.exports = {  folder , file }