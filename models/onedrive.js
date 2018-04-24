
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const format = require('../utils/format')
const qs = require('querystring')

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
    resp = await http.get('https://onedrive.live.com/?authkey='+params.authkey+'&id='+params.resid+'&cid='+cid , {followRedirect:false})

    _cookie = resp.headers['set-cookie'].join('; ')
    _appid = (resp.body.match(/"appId":"(\d+)"/) || ['',''])[1]
    console.log('update authkey:',_authkey)
  }
}

// 非公开接口 ~ 可获取最详细的信息
const folder = async(id , _) => {
  _ = _ || {}
  let nocache = _.nocache
  // shareid
  if(/^s!/.test(id)){
    id = await conv(id)
  }

  let resid = 'od_' + id , resp = {id , type:'folder' , provider:'od',children:[]}


  if(cache(resid) && !nocache) {
    resp = cache(resid)
    
    if(
      resp.updated_at && 
      resp.children &&
      ( Date.now() - resp.updated_at < config.data.cache_refresh_dir)

    ){
      console.log('get od folder from cache')
      return resp
    }
  }


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

  r = JSON.parse(r.body)
  if(r.error){
    console.log(r)
  }else{

    r = (r.items || [r.item])[0]
    children = r.folder ? r.folder.children.map((i)=>{
      let ext = i.extension ? i.extension.replace(/\./g,'') : ''

      return base.extend({
        id:i.id,
        name: i.name + (i.folder ? '' : i.extension),
        parent:i.parentId,
        mime:i.mimeType,
        created_at:i.displayCreationDate.replace(/\//g,'-'),
        updated_at:i.displayModifiedDate.replace(/\//g,'-'),
        size:i.displaySize,
        ext: ext,
        type : i.folder ? 'folder' : base.mime_type(ext),
        provider:'od',
        url: i.folder ? '' : i.urls.download,
        url_updated:Date.now()
      } , format.ln(i.name + (i.folder ? '' : i.extension)))
    }) : []

    resp.updated_at = Date.now()
    resp.children = children
    cache(resid,resp)
  }
  return resp
}

// shareid => id
const conv = async(shareid)=>{
  if(cache('od_'+shareid)){
    return cache('od_'+shareid)
  }

  let url = 'https://1drv.ms/f/'+shareid.replace('od_','')
  let r = await http.get(url , {followRedirect:false})
  if(r.headers && r.headers.location){
    let params = base.params(r.headers.location)
    // cache('$onedrive.authkey' , params.authkey)
    cache('od_'+shareid , params.resid)
    return params.resid
  }else{
    return ''
  }

}


// 似乎没有办法只根据 id + authkey 获取到 ~
const file = async(id , data) =>{
  if(
    data && 
    data.url_updated && 
    data.url &&
    ( Date.now() - data.url_updated < config.data.cache_refresh_file)

  ){
    console.log('get od file from cache')
    return data
  }

  //刷新父路径
  let parent = await folder(data.parent , {nocache:true})

  let index = base.search(parent.children , 'id' , id)

  if(index != -1){
    return parent.children[index]
  }else{
    return ''
  }
}


module.exports = { folder , file }