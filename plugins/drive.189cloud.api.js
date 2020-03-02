const name = '189CloudAPI'

const version = '1.0'

const protocols = ['ctc']

const defaultProtocol = 'ctc'

const googledrive_max_age_dir = 600 * 1000

const { URL } = require('url')

const urlFormat = require('url').format

const crypto = require('crypto')

const fileIdMap = {}

const parseXML = require('xml2js').parseString


const hmac = (v , key) => {
  return crypto.createHmac('sha1', key).update(v).digest('hex')
}

const xml2js = ( xml , options = {}) => {
  return new Promise((resolve , reject) => {
    parseXML(xml, options, (err, res) => {
      if (err) throw err
      resolve(res)
    })
  })
}

const isSecretUrl = (url) => {
  return true //!(url.includes('://127.0.0.1') == false && url.includes('://localhost') == false && url.startsWith('https') == false)
}
class OAuth2 {
  constructor(request, qs, handleUpdate) {
    this.request = request
    this.qs = qs
    this.handleUpdate = handleUpdate

    this.clientMap = {}
    this.pathAppMap = {}

    this.SCOPES = [];

    this.OAUTH2_AUTH_BASE_URL = "https://cloud.189.cn/open/oauth2/authorize.action"
    this.OAUTH2_TOKEN_URL = "https://cloud.189.cn/open/oauth2/accessToken.action"

    // this.OAUTH2_AUTH_BASE_URL = "https://oauth.api.189.cn/emp/oauth2/v3/authorize"
    // this.OAUTH2_TOKEN_URL = "https://oauth.api.189.cn/emp/oauth2/v3/access_token"

    // this.PROXY_URL = 'http://101.227.251.180:10001/open189/authentication/redirect.php'
    this.PROXY_URL = 'https://reruin.github.io/redirect/onedrive.html'

  }

  init(data) {
    for(let { path ,credentials } of data){
      let { app_id , app_secret , refresh_token , redirect_uri , expires_in , access_token} = credentials
      if( app_id ){
        this.clientMap[app_id] = { 
          app_id, app_secret, refresh_token,redirect_uri,access_token,
          update_time:0,
          expires_in:expires_in ? parseInt(expires_in) : 0
        }
      }
    }
  }

  async generateAuthUrl(config) {
    const { app_id, app_secret, redirect_uri } = config
    const timestamp = Math.floor(Date.now() / 1000)
    const opts = {
      appKey:app_id,
      appSignature:hmac(`appKey=${app_id}&timestamp=${timestamp}` , app_secret),
      responseType: 'code',
      callbackUrl:redirect_uri+'?',
      timestamp,
      display:'default',
      // app_id,
      // redirect_uri
    };

    if(!isSecretUrl(redirect_uri)){
      opts.callbackUrl = this.PROXY_URL
      opts.state = redirect_uri
      //redirect_uri = this.PROXY_URL
    }
    //console.log(`appKey=${app_id}&timestamp=${timestamp}` , app_secret)
    this.pathAppMap[redirect_uri] = { app_id, app_secret, redirect_uri:opts.redirect_uri, create_time: Date.now() }

    return `${this.OAUTH2_AUTH_BASE_URL}?${this.qs.stringify(opts)}`;
  }

  //验证code 并获取 credentials
  async getToken(key, code) {
    let appConfig = this.pathAppMap[key]

    if (!appConfig) return { error: true, msg: '没有匹配到app_id' }

    let { app_id, app_secret, redirect_uri } = appConfig

    return await this.authToken({ app_id, app_secret, redirect_uri , code },key)
  }

  async authToken({app_id, app_secret, redirect_uri , code} , key){
    const timestamp = Math.floor(Date.now() / 1000)

    let params = {
      appKey:app_id,
      appSignature:hmac(`appKey=${app_id}&timestamp=${timestamp}` , app_secret),
      timestamp,
      code,
      grantType: 'authorization_code'
    }
    let resp
    try {
      resp = await this.request.get(this.OAUTH2_TOKEN_URL, {qs:params , json: true })
    } catch (e) {
      resp = e
    }
    console.log(resp)

    if (resp.body && !resp.body.error) {
      let { expiresIn, accessToken } = resp.body

      this.clientMap[app_id] = { app_id, app_secret, redirect_uri, expires_in:expiresIn, access_token:accessToken , update_time:Date.now() }
      if(key) delete this.pathAppMap[key]
      await this.handleUpdate(this.clientMap[app_id])

      return this.clientMap[app_id]
    } else {
      return { error: true, msg: resp.body ? resp.body.error_description : 'unknow error' }
    }
  }

  async getCredentials(app_id) {
    let credentials = this.clientMap[app_id]
    if (credentials) {
      let { update_time, expires_in , refresh_token } = credentials
      if ((Date.now() - update_time) < expires_in * 1000 * 0.9) {
        return credentials
      }
      else if(refresh_token){
        return await this.refreshAccessToken(credentials)
      }
      else{
        return credentials
      }
    }
  }

  async refreshAccessToken(credentials) {
    let { app_id, app_secret, redirect_uri, refresh_token } = credentials
    if (app_id && app_secret /*&& redirect_uri*/ && refresh_token) {

      let params = {
        app_id,
        app_secret,
        // redirect_uri, 
        refresh_token,
        grant_type: 'refresh_token'
      }

      try {
        let resp = await this.request.post(this.OAUTH2_TOKEN_URL, params, { json: true })
        let body = resp.body
        if (body.access_token) {
          credentials.access_token = body.access_token
          credentials.expires_in = body.expires_in
          credentials.update_time = Date.now()
          if(body.refresh_token) credentials.refresh_token = body.refresh_token
          this.clientMap[app_id] = credentials
          await this.handleUpdate(this.clientMap[app_id])
          console.log('refreshAccessToken success')

          return credentials
        }
      } catch (e) {
        return {error:true , msg:e.body ? e.body.error_description:'挂载失败'}
      }
    }
    return {error:true , msg:'refreshAccessToken 失败，缺少参数'}
  }
}

const error = async (msg, href) => {
  return `
    <div class="auth">
      <h3>挂载 天翼云 失败</h3>
      <p style="font-size:12px;">失败请重试。原因：${msg}</p>
      <p style="font-size:12px;"><a style="font-size:12px;margin-right:5px;color:#337ab7;" href="${href}">点此重新开始</a></p>
    </div>
  `
}

const install = async (app_id, app_secret, redirect_uri) => {
  return `
    <div class="auth">
      <h3>天翼云 挂载向导</h3>
      <!--<p style="font-size:12px;">前往 <a href="https://portal.azure.cn/?whr=azure.com#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps" target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;">Azure管理后台</a> 注册应用获取应用机密 和 应用ID。</p>-->
      <div>
        <form class="form-horizontal" method="post">
          <input type="hidden" name="act" value="install" />
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <div class="form-group"><input class="sl-input" type="text" name="app_secret" value="" placeholder="应用机密 / app_secret" /></div>
          <div class="form-group"><input class="sl-input" type="text" name="app_id" value="" placeholder="应用ID / app_id" /></div>
          <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
      </div>
    </div>
  `
}

const parseCredentials = ({name,path}) => {
  let data = new URL(path)
  let credentials = { app_id : data.host }
  for (const [key, value] of data.searchParams) {
    credentials[key] = value
  }
  return {
    name,
    protocol:data.protocol.split(':')[0],
    path: data.pathname.replace(/^\//,''),
    credentials
  }
}

const createId = (app_id , path) => {
  return urlFormat({
    protocol: defaultProtocol,
    slashes:true,
    hostname: app_id,
    pathname: path,
  })
}
// fileid->app_credentials
module.exports = ({ request, cache, getConfig, querystring, base64, saveDrive, getDrive, getDrives , getRuntime , wrapReadableStream}) => {

  const oauth2 = new OAuth2(request, querystring , async (c) => {
    let paths = await getDrives()
    let data = paths
      .map(i => parseCredentials(i))


    //是否有其他配置参数
    let hit = data.filter(i => i.credentials.app_id == c.app_id)

    //无配置参数匹配路径名
    if( hit.length == 0 ){
      const name = decodeURIComponent(getRuntime('req').path.replace(/^\//g,''))
      hit = data.filter(i => i.name == name)
    }

    //路径也无法匹配
    if( hit.length == 0 ){
      //仅有一个可用挂载源
      if(data.length == 1 && paths.length == 1 && paths[0].root){
        hit = data
      }
    }

    hit.forEach(i => {
      let key = urlFormat({
        protocol: i.protocol,
        hostname: c.app_id,
        pathname: (i.path == '/' || i.path == '' ) ? '/root' : i.path,
        slashes:true,
        query:{
          app_secret:c.app_secret,
          redirect_uri:c.redirect_uri,
          refresh_token:c.refresh_token
        }
      })
      saveDrive(key , i.name)
    })
  })

  //获取所有相关根目录，并创建凭证
  getDrives().then(resp => {
    let credentials = resp.map(i => parseCredentials(i))
    oauth2.init(credentials)
  })

  const getCredentials = async (id) => {
    let data = new URL(id)
    let ret = { path : data.pathname.replace(/^\//,'') , app_id: data.host }
    if (ret.app_id) {
      ret.credentials = await oauth2.getCredentials(ret.app_id)
    }
    return ret
  }

  const prepare = async (id) => {
    if(!id.startsWith(defaultProtocol)){
      id = defaultProtocol + ':' + id
    }
    const req = getRuntime('req')

    let baseUrl = req.origin + req.path

    let { path, credentials } = await getCredentials(id)
    // 无credentials
    if(!credentials){
      if (req.body && req.body.act && req.body.act == 'install') {
        let { app_id, app_secret, proxy_url } = req.body
        if (app_id && app_secret) {
          return {
            id,
            type: 'folder',
            protocol: defaultProtocol,
            redirect: await oauth2.generateAuthUrl({ app_id, app_secret, redirect_uri: baseUrl })
          }
        }
      }

      // 挂载验证回调
      if (req.query.code) {
        let credentials = await oauth2.getToken(baseUrl, req.query.code)
        if (credentials.error) {
          return {
            id,
            type: 'folder',
            protocol: defaultProtocol,
            body: await error(credentials.msg, baseUrl)
          }
        } else {
          return {
            id,
            type: 'folder',
            protocol: defaultProtocol,
            redirect: baseUrl
          }
        }
      }
    }
    // 存在无credentials
    else{
      //credentials验证过程出错
      if (credentials.error){
        return {
          id,
          type: 'folder',
          protocol: defaultProtocol,
          body: await error(credentials.msg, baseUrl)
        }
      }
      console.log(credentials)
      if (credentials.app_id ) {
        if (credentials.access_token) {
          console.log('><><><')
          return { path, credentials }
        }
        // 缺少 refresh_token 跳转至验证页面
        else{
          //校验redirect_uri 与当前连接是否一致
          if( credentials.redirect_uri == baseUrl ){
            return {
              id,
              type: 'folder',
              protocol: defaultProtocol,
              redirect: await oauth2.generateAuthUrl({ ...credentials, redirect_uri: baseUrl })
            }
          }
        }
      }
    }
    //挂载提示
    return {
      id,
      type: 'folder',
      protocol: defaultProtocol,
      body: await install(baseUrl)
    }
  }

  const fetch = (operate = 'GET' , url , credentials , qs) => {
    let date = new Date().toGMTString()
    let signature = hmac(`AccessToken=${credentials.access_token}&Operate=${operate}&RequestURI=${url}&Date=${date}`,credentials.app_secret)

    let headers = {
      AccessToken:credentials.access_token,
      Signature:signature,
      Date:date,
      'content-type':'application/json',
      "accept":"application/json"
    }
    return request({
      url:`https://api.cloud.189.cn${url}`,
      headers,
      method:operate,
      qs, json:true,
      async:true,
    })
  }

  const folder = async (id, options) => {

    let predata = await prepare(id)

    if (!predata.credentials) return predata

    let { path, credentials } = predata
    let r = cache.get(id)
    if (r) {
      if (
        r.$cached_at &&
        r.children &&
        (Date.now() - r.$cached_at < googledrive_max_age_dir)

      ) {
        console.log(Date.now()+' CACHE 189Cloud '+ id)
        return r
      }
    }
    let api = '/listFiles.action'

    let qs = {
      app_id:`${credentials.app_id}`,
      access_token:`${credentials.access_token}`,
    }
    if(path) qs.folderId = path

    let resp = await fetch('GET','/listFiles.action', credentials , {
      folderId:path,
      iconOption:1
    })

    if(resp.body){
      resp.body = await xml2js(resp.body)
    }

    console.log(resp.body)

    if (resp.body.res_message) {
      return {
        id, type: 'folder', protocol: defaultProtocol,body:resp.body.res_message
      }
    }

    let children = []
    for(let file of resp.fileList.folder){
      children.push({
        id: createId(credentials.app_id , file.id),
        name: file.name,
        ext: file.fileExtension,
        protocol: defaultProtocol,
        // parent:i[1][0],
        mime: file.mimeType,
        created_at: file.modifiedTime,
        updated_at: file.modifiedTime,
        size: parseInt(file.size),
        type: file.mimeType.indexOf('.folder') >= 0 ? 'folder' : undefined,
      })
    }
    
    for(let file of resp.fileList.file){
      children.push({
        id: createId(credentials.app_id , file.id),
        name: file.name,
        ext: file.fileExtension,
        protocol: defaultProtocol,
        // parent:i[1][0],
        mime: file.mimeType,
        created_at: file.modifiedTime,
        updated_at: file.modifiedTime,
        size: parseInt(file.size),
        type: file.mimeType.indexOf('.folder') >= 0 ? 'folder' : undefined,
      })
    }
    

    //缓存 pathid(fid->appid)  <=> path
    //cache.set(baseUrl , id)
    // console.log(children)
    let result = { id, type: 'folder', protocol: defaultProtocol }
    result.$cached_at = Date.now()
    result.children = children
    
    cache.set(id, result)

    return result
  }

  // 无临时链接 强制中转
  const file = async (id, options) => {
    let predata = await prepare(id)

    if (!predata.credentials) return predata

    let { path, credentials } = predata

    let data = options.data || {}

    let api = `http://api.189.cn/ChinaTelecom/getFileDownloadUrl.action`

    let resp = await request.get(api, {
      qs: {
        app_id:`${credentials.app_id}`,
        access_token:`${credentials.access_token}`,
        fileId:path
      },
      json: true
    })

    console.log(resp)

    // result.fileDownloadUrl
    return {
      id,
      url: api,
      name: data.name,
      ext: data.ext,
      protocol: defaultProtocol,
      proxy: true,
      size:data.size,
    }
  }


  const request_fix = (...rest) => {
    let req = request(...rest)
    // request 作为 writestream 时不会emit finish
    req.on('end' ,function(){
      this.emit('finish')
    })
    req.on('error' , (e)=>{
      console.log(e)
    })
    return req
  }
  
  const metadata = async ({ name , key = 'id' , parentId = 'root' , credentials } = {}) => {
    let api = 'https://www.googleapis.com/drive/v3/files'
    let resp = false
    try{
       resp = await request.get(api, {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          // 'Content-Type': 'application/json'
        },
        qs: {
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          pageSize: 1,
          fields: `files(${key})`,
          q: `name = '${name}' and trashed = false and '${parentId}' in parents`,
        },
        json: true
      })
      if(resp.body.files && resp.body.files.length > 0){
        resp = resp.body.files[0]
      }else{
        return false
      }
      
    }catch(e){
      return undefined
    }
   
    return resp
  }
  //目录是否存
  // /a/b.txt
  const exists = async (path , parentId = 'root') => {
    let lv = path.replace(/(^\/|\/$)/g,'').split('/')

    for(let i = 0; i < lv.length - 1; i++){
      let name = decodeURIComponent(lv[i])
      let resp = await metadata({ name , parentId})

      if (resp === undefined) {
        return undefined
      }else if(resp === false){
        //不存在文件
        return false
      }else{
        parentId = resp.id
      }
    }

    return true
  }

  //查找最近的目录
  const search = async (lv , credentials, parentId="root") => {
    let i = 0
    for(; i < lv.length - 1; i++){

      let p = lv.slice(0,i+1).join('/')

      if( fileIdMap[p] ){

        parentId = fileIdMap[p]

      }else{

        let name = decodeURIComponent(lv[i])
        
        let resp = await metadata({ name , parentId , credentials})

        if (resp === undefined) {
          console.log('metadata undefined',name , parentId)
          return undefined
        }else if(resp === false){
          //目录不存
          break;
        }else{
          fileIdMap[p] = resp.id 

          parentId = resp.id
        }
      }
    }

    return [i , parentId]
  }

  // 在 指定位置创建目录 
  // 返回 创建的目录ID
  const mkdir = async (parentId , path , credentials) => {
    let api = `https://www.googleapis.com/drive/v3/files`
    let children = path.replace(/(^\/|\/$)/g,'').split('/')
    let error = false

    console.log('children length',children.length)
    //无需创建
    if(children.length <= 1 ) return parentId

    //存在的最外层目录
    let metadata = await search(children , credentials , parentId)

    if( metadata === undefined ){
      return false
    }

    let i = metadata[0]
    parentId = metadata[1]
    //递归创建
    for(; i < children.length - 1; i++){
      let name = decodeURIComponent(children[i])

      try{
        resp = await request.post(api,{
          'name':name,
          'parents': [parentId],
          'mimeType':'application/vnd.google-apps.folder',
        },{
          headers:{
            'Authorization': `Bearer ${credentials.access_token}`,
            'Content-Type': 'application/json'
          },
          is_body:true, 
          json:true
        })

        if( resp.body ){
          parentId = resp.body.id
        }
      }catch(e){
        console.log('error',e.body)
        resp = e.body
      }
     
    }

    return parentId
  }


  //变更文件信息
  const patch = (fileId , name , parent , credentials) => {
    let api = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${parent}&removeParents=root`
    request({
      url:api , 
      method:'PATCH',
      headers:{
        'Authorization': `Bearer ${credentials.access_token}`,
      },
      body:{ name },
      json:true
    },function(error, response, body) {
      if (!error) {
        console.log(body)
      } else {
        console.log(error)
      }
    })
  }

  // > 5 * 1024 * 1024 标准上传
  const upload = async ({folderId , name , size , credentials}) => {
    let api = `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`
    let resp , uploadUrl
    try{
      resp = await request.post(api,{
        name , 
        parents:[folderId]
      },{
        headers:{
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        is_body:true, 
        json:true,
        //followRedirect:false
      })
      //https://developers.google.com/drive/api/v3/manage-uploads#resumable
      //If the session initiation request succeeds, the response includes a 200 OK HTTP status code. In addition, it includes a Location header that specifies the resumable session URI. Use the resumable session URI to upload the file data and query the upload status.
      if(resp.headers && resp.headers.location){
        uploadUrl = resp.headers.location
      }
    }catch(e){
      console.log('error>>>',e.body)
      return { error: e.body }
    }

    console.log(uploadUrl)
    if(!uploadUrl) return false

    let req = request_fix({
      url:uploadUrl , 
      method:'POST',
      headers:{
        'Authorization': `Bearer ${credentials.access_token}`,
      },
    })
    return req
  }

  const uploadFast = async ({ folderId , credentials }) => {
    let api = `https://www.googleapis.com/upload/drive/v3/files?uploadType=media`
    let req = request_fix({
      url:api , 
      method:'POST',
      headers:{
        'Authorization': `Bearer ${credentials.access_token}`,
        // 'Content-Type': 'image/jpeg'
      },
    },function(error, response, body) {
      if (!error) {
        console.log(body)
      } else {
        console.log(error)
      }
    })
    return req
  }


  const createReadStream = async ({id , size , options = {}} = {}) => {
    let predata = await prepare(id)

    if (!predata.credentials) return null

    let { path, credentials } = predata

    let url = `https://www.googleapis.com/drive/v3/files/${path}?alt=media`

    let readstream = request({
      url,
      method:'get' , 
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`
      }
    })

    return wrapReadableStream(readstream , { size: size } )
  }

  const createWriteStream = async ({ id , options = {} , size , target = ''} = {}) => {

    let predata = await prepare(id)

    if (!predata.credentials) return null

    let { path:parentId, credentials } = predata
    
    let folderId = await mkdir(parentId , target, credentials)

    if( folderId === false ) return false

    let name = target.split('/').pop()

    if( size !== undefined ){
      cache.clear(id)

      if( size <= 5242880 ){
        return await upload({folderId , name , size , credentials })
      }else{
        return await upload({folderId , name , size , credentials })
      }
    }

  }
  return { name, version, drive: { protocols, folder, file , createReadStream , createWriteStream } }
}
