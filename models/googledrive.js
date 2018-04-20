
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const host = 'https://drive.google.com'
const format = require('../utils/format')

const last_hash = {}

const guest_type = (v)=> {
  if(['mp4' , 'mpeg' , 'wmv' , 'webm' , 'avi' , 'rmvb' , 'mov' , 'mkv','f4v','flv'].indexOf(v) >= 0){
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

// gd folder => files
const folder = async(id) => {
  if(cache(id)) return cache(id)

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
    return {
      id:i[0],
      name:i[2],
      parent:i[1][0],
      mime:i[3],
      created_at:format.datetime(i[9]),
      updated_at:format.datetime(i[10]),
      size:format.byte(i[13]),
      ext:i[44],
      type : i[13] ? guest_type(i[44]) : 'folder',
      provider:'gd',

    }
  }) : []

  cache(id,children)
  return children
}


const file = async(id) =>{

  let reallink = ''
  let { body , headers }  = await http.get(host + '/uc?id='+id+'&export=download',{followRedirect : false})
  if(headers && headers.location){
    reallink = headers.location
  }else{
    let url = (body.match(/\/uc\?export=download[^"']+/i) || [''])[0]
    url = url.replace(/&amp;/g,'&')
    let cookie = headers['set-cookie'].join('; ')
    ///uc?export=download&confirm=uIJj&id=0B0vQvfdCBUFjOXM1UXV0MHhkeGM
    let resp = await http.get(host + url , {headers:{'Cookie':cookie} , followRedirect : false})
    if(resp.headers && resp.headers.location){
      reallink = resp.headers.location
    }
  }
  return reallink
}



module.exports = { folder , file }