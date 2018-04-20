
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const format = require('../utils/format')
const qs = require('querystring')

const last_hash = {}

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

var _authkey , _appid , _rootcid , _cookie

//有两个接口可获取信息
/// https://skyapi.onedrive.live.com/API/2/GetItems 需要 appid authkey id cid
/// https://storage.live.com/items/ 需要 id

// get authkey
const getAuth = async() => {
  if(!_authkey){
    await updateAuth()
  }
  return { authkey: _authkey , cookie:_cookie, appid: _appid}
}

const updateAuth = async() => {
  let authid = cache('$onedrive.authid')
  let url = 'https://1drv.ms/f/' + authid
  let resp = await http.get(url,{followRedirect:false})
  if(resp.headers && resp.headers.location){
    let params = base.params(resp.headers.location)
    _authkey = params.authkey
    let cid = params.resid.split('!')[0].toLowerCase()
    console.log('params',params)
    resp = await http.get('https://onedrive.live.com/?authkey='+params.authkey+'&id='+params.resid+'&cid='+cid , {followRedirect:false})

    _cookie = resp.headers['set-cookie'].join('; ')
    _appid = (resp.body.match(/"appId":"(\d+)"/) || ['',''])[1]
    console.log('update authkey:',_authkey)
  }
}

// 非公开接口 ~ 可获取最详细的信息
const folder = async(id) => {
  // shareid
  if(/^s!/.test(id)){
    id = await conv(id)
  }

  if(cache(id)) return cache(id)
  
  let {authkey ,cookie, appid} = await getAuth()

  let children = []

  let cid = id.split('!')[0].toLowerCase()

  let opts = {
    authKey: authkey,
    id: id,
    cid: cid,

    //以上参数必须
    caller: '',
    sb: 0,
    ps: 100,
    sd: 0,
    gb: '0,1,2',
    d: '1',
    m: 'zh-CN',
    iabch: '1',
    pi: '5',
    path: '1',
    lct: '1',
    rset: 'odweb',
    v: Math.random(),
    si: '0',
    
  }
  let headers = {
    "X-SkyApiOriginId": "" + Math.random(),
    "AppId":appid,
    "Accept": "application/json",
    //以上三项必须
    "Host": "skyapi.onedrive.live.com",
    "Referer": "https://skyapi.onedrive.live.com/xmlproxy.htm?domain=live.com",
    "Cookie":cookie
  }

  r = await http.get( 'https://skyapi.onedrive.live.com/API/2/GetItems?'+qs.stringify(opts) , {followRedirect:false,headers})
  // r = JSON.parse(r)

  console.log('get from api')
  r = JSON.parse(r.body)
  if(r.error){
    console.log(r)
  }else{

    r = (r.items || [r.item])[0]
    children = r.folder ? r.folder.children.map((i)=>{
      let ext = i.extension ? i.extension.replace(/\./g,'') : ''

      return {
        id:i.id,
        name: i.name + (i.folder ? '' : i.extension),
        parent:i.parentId,
        mime:i.mimeType,
        created_at:i.displayCreationDate.replace(/\//g,'-'),
        updated_at:i.displayModifiedDate.replace(/\//g,'-'),
        size:i.displaySize,
        ext: ext,
        type : i.folder ? 'folder' : guest_type(ext),
        provider:'od',
        download: i.folder ? '' : i.urls.download
      }
    }) : []

    cache(id , children)
  }
  
  return children

}

// shareid => id
const conv = async(shareid)=>{
  if(cache(shareid)){
    return cache(shareid)
  }else{
    let url = 'https://1drv.ms/f/'+shareid
    let r = await http.get(url , {followRedirect:false})
    if(r.headers && r.headers.location){
      let params = base.params(r.headers.location)
      // cache('$onedrive.authkey' , params.authkey)
      cache(shareid , params.resid)
      return params.resid
    }else{
      return ''
    }
  }

}


// 似乎没有办法只根据 id + authkey 获取到 ~
const file = async(id , cid) =>{
  let resp
  console.log('get file from cid:',cid)
  if(cache(cid)){
    resp = cache(cid)
  }else{
    resp = await folder(cid)
  }

  let hash = base.hash(resp , 'id')
  if(hash[id]){
    return hash[id].download
  }else{
    return ''
  }


  // ???????????????? 没有用 ~
  // let link = ''
  // let url = 'https://storage.live.com/items/'+id+'?'+name+'&authkey='+authkey
  
  // let resp = await http.header(url , {followRedirect:false})

  // console.log(resp.headers)

  // if(resp.headers){
  //   link = resp.headers['location'] || resp.headers['content-location']
  //   // invalid authkey
  //   if(link.indexOf('login.live.com')>=0){
  //     await getAuthKey()
  //     // again 
  //     link = file(id , name)
  //   }
  // }

  // return link
}


// path => gd folder => files
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

  // /a/b/c
  if( hit.type == 'folder' ){
    resp = await folder(hit.id)
  }
  // /a/b/c.jpg
  else{
    resp = await file(hit.id)
    resp = { url : resp , type : hit.type , name : hit.name}
  }

  return resp
  
}

const mount = () =>{
  let data = config.data , key
  if(Array.isArray( data.path )){
    if(data.path.length == 1){
      key = data.path[0].path
    }else{
      //根路径不判断缓存，防止添加路径路径时丢失
      let disk = data.path.map((i,index)=>({
        id : i.path,
        name : i.name,
        size : '-',
        updated_at : '-',
        type : 'folder'
      }))
      cache('root' , disk)
      key = 'root'
    }
    
  }else{
    key = data.path
  }
  return {id:key , type:'folder'}

}


module.exports = { folder , file }