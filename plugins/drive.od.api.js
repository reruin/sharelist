/*
 * One Drive API
 * 使用官方API挂载
 * token -x-> generateAuthUrl --code--> getToken 
 */

const name = 'OneDriveAPI'

const version = '1.0'

const protocols = ['oda']

const defaultProtocol = 'oda'

const fs = require('fs')

const path = require('path')

const onedrive_max_age_dir = 3600 * 1000 * 0.9


// https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/resources/driveitem?view=odsp-graph-online
// There are two primary ways of addressing a driveItem resource:

// By the driveItem unique identifier using drive/items/{item-id}
// By file system path using /drive/root:/path/to/file

const apis = {
  oauthUrl:'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  authorizeUrl:(client_id, scope, redirect_uri) => `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${client_id}&scope=${scope}&response_type=code&redirect_uri=${redirect_uri}`,
  list:path => 'https://graph.microsoft.com/v1.0' + ((!path || path == '/') ? `/me/drive/root/` : `/me/drive/items/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`) + 'children?select=id,name,size,file,folder,@microsoft.graph.downloadUrl,thumbnails,createdDateTime,lastModifiedDateTime&top=999999',
  listById:itemId => `/me/drive/items/${itemId}`,
}

class oauth2ForOd {
  constructor(request){
    this.request = request
    this.clientMap = {}
    this.pathAppMap = {}

  }
  async createAppLink(redirect_uri){
    if(redirect_uri.indexOf('://localhost') == -1){
      //redirect_uri = 'https://sharelist.github.io/'
    }

    let ru = `https://developer.microsoft.com/en-us/graph/quick-start?appID=_appId_&appName=_appName_&redirectUrl=${redirect_uri}&platform=option-node`;
    let deepLink = `/quickstart/graphIO?publicClientSupport=false&appName=sharelist&redirectUrl=${redirect_uri}&allowImplicitFlow=false&ru=` + encodeURIComponent(ru);
    let app_url = "https://apps.dev.microsoft.com/?deepLink=" + encodeURIComponent(deepLink);

    return app_url
  }

  async generateAuthUrl (client_id, client_secret, redirect_uri , uri) {
    let scope = encodeURIComponent("offline_access files.readwrite.all");
    let link = apis.authorizeUrl(client_id , scope , redirect_uri);
    
    if(uri.indexOf('://localhost') == -1){
      //link += '&state='+encodeURIComponent(uri);
    }
    
    this.pathAppMap[uri] = {client_id , client_secret , redirect_uri , create_time:Date.now()}

    return link; 
  }

  async getToken(key , code){
    let appConfig = this.pathAppMap[key]
    if(appConfig){
      let {client_id , client_secret , redirect_uri} = appConfig
      let params = { ...appConfig , code , grant_type:'authorization_code'}
      let resp
      try{
        resp = await this.request.post(apis.oauthUrl , params , { json:true })
      }catch(e){
        resp = e
      }
      if(resp.body){
        let { refresh_token , expires_in , access_token } = resp.body
        let clientId = [client_id , client_secret , redirect_uri , refresh_token].join("|")
        this.clientMap[clientId] = {client_id , client_secret , redirect_uri , refresh_token, expires_in, access_token}
        delete this.pathAppMap[key]
        return clientId
      }else{
        return { error: true , msg:resp.error_description }
      }
    }else{
      return { error: true , msg:'没有匹配到app_id' }
    }
  }

  async get(key){
    let [client_id, client_secret , redirect_uri ,refresh_token] = key.split('|');
    if(client_id && client_secret && redirect_uri && refresh_token){
      //TODO 此处应用定时任务
      if(this.clientMap[key]){
        let { update_time , expires_in} = this.clientMap[key]
        if((Date.now() - update_time) < this.clientMap[key].expires_in * 1000 * 0.9){
          return this.clientMap[key]
        }
      }
      return await this.refreshToken({client_id, client_secret , redirect_uri ,refresh_token})
    }
    else {
      return false
    }
  }

  async refreshToken({client_id, client_secret , redirect_uri ,refresh_token}){
    if(client_id && client_secret && redirect_uri && refresh_token){
      let params = { client_id, client_secret, redirect_uri, refresh_token, grant_type:'refresh_token'}
      try{
        let resp = await this.request.post(apis.oauthUrl , params , {json:true})
        let { refresh_token:refresh_token_new , expires_in , access_token } = resp.body
        if( access_token ){
          let key = [client_id, client_secret , redirect_uri , refresh_token].join('|');
          this.clientMap[key] = { client_id, client_secret, redirect_uri, refresh_token, access_token , expires_in , update_time:Date.now() }
          return this.clientMap[key]
        }
      }catch(e){
        return false
      }
    }
    return false
  }

}

//kvfXIY=|jxghTDHU23564:%
// client Id  --> client_id:client_secret


module.exports = ({ request, cache, getConfig, querystring, getLocation , base64 , saveDrive , getDrive}) => {

  const oauth2 = new oauth2ForOd(request)

  const extname = (p) => path.extname(p).substring(1)

  const install = async (redirect_uri) => {
    let authUrl = await oauth2.createAppLink(redirect_uri)
    return `
      <div class="auth">
        <h3>OneDrive 挂载向导</h3>
        <p style="font-size:12px;"><a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" href="${authUrl}">访问此链接</a>获取 应用机密 和 应用ID</p>
        <div>
          <form class="form-horizontal" method="post">
            <input type="hidden" name="act" value="install" />
            <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
            <div class="form-group"><input class="sl-input" type="text" name="client_secret" placeholder="应用机密 / app_secret" /></div>
            <div class="form-group"><input class="sl-input" type="text" name="client_id" placeholder="应用ID / app_id" /></div>
            <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
        </div>
      </div>
    `
  }

  const error = async (msg , href) => {
    return `
      <div class="auth">
        <h3>挂载 OneDrive 失败</h3>
        <p style="font-size:12px;">失败请重试。原因：${msg}</p>
        <p style="font-size:12px;"><a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" href="${href}">点此重新开始</a></p>
      </div>
    `
  }


  // id / path
  // oda:app_id|app_secure|redirect_uri|refresh_token->/path
  const folder = async (id,{req}) => {
    let resid = `${defaultProtocol}:${id}`

    let result = { id, type: 'folder', protocol: defaultProtocol }

    let r = cache.get(resid)
    if(r) {
      if(
        r.$cached_at && 
        r.children &&
        ( Date.now() - r.$cached_at < onedrive_max_age_dir)

      ){
        console.log('get onedrive folder from cache')
        return r
      }
    }

    let [fid,key] = id.split('->')

    if(key){
      let accessConfig = await oauth2.get(key)

      //跳转到安装指引
      if(accessConfig == false){
        return {
          id,
          type: 'folder',
          protocol: defaultProtocol,
          body: await install(req.href)
        }
      }else{
        
        let api = apis.list(fid)
        
        let resp = await request.get(api , {headers:{
          'Authorization':`bearer ${accessConfig.access_token}`,
          'Content-Type': 'application/json'
        },json:true})

        if(resp.body){
          let children = resp.body.value.map(i=>({
            id: (fid+'/'+i.name).replace(/\/{2,}/g,'/')+'->'+key,
            fid:i.id,
            name: i.name,
            protocol: defaultProtocol,
            size: i.size,
            created_at: i.createdDateTime,
            updated_at: i.lastModifiedDateTime,
            ext: extname(i.name),
            url:i['@microsoft.graph.downloadUrl'],
            type: i.folder ? 'folder' : 'other'
          }))

          result.$cached_at = Date.now()
          result.children = children

          cache.set(resid,result)

          return result
        }else{
          return false
        }
      }
    }


    //验证app_id 和 app_secret
    if(req.body && req.body.act && req.body.act == 'install'){
      let href = req.origin + req.path

      let { client_id , client_secret , redirect_uri } = req.body
      if(client_id && client_secret && redirect_uri){
        return {
          id,
          type: 'folder',
          protocol: defaultProtocol,
          redirect: await oauth2.generateAuthUrl(client_id , client_secret , redirect_uri , href)
        }
      }
    }


    //验证完成回调
    if(req.query.code){
      let href = req.origin + req.path
      let tokenResult = await oauth2.getToken(href , req.query.code)
      if(tokenResult.error){
        // 刷新页面 
        return {
          id,
          type: 'folder',
          protocol: defaultProtocol,
          body: error(tokenResult.msg , href)
        }
      }
      else {
        currentDrive = getDrive()
        let [prefix] = currentDrive.split('->')
        saveDrive(prefix+'->'+tokenResult)
        // 刷新页面 
        return {
          id,
          type: 'folder',
          protocol: defaultProtocol,
          redirect: href
        }
      }
      
    }

    if(req.query.error && req.query.error_description){
      let href = req.origin + req.path

      return {
        id,
        type: 'folder',
        protocol: defaultProtocol,
        body: await error(`[${req.query.error}]${req.query.error_description}`, href)
      }
    }

    //finnal
    return {
      id,
      type: 'folder',
      protocol: defaultProtocol,
      body: await install(req.href)
    }

  }

  const file = async (id , data = {}) => {
    //data.url = data.downloadUrl
    // console.log(id , data)
    return data
  }
  
  return { name, version, drive: { protocols, folder, file } }
}