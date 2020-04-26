const name = '189CloudAPI'

const version = '1.0'

const protocols = ['ctc']

const defaultProtocol = 'ctc'

const max_age_dir = 30 * 60 * 1000

const max_age_file = 3 * 60 * 1000

const { URL } = require('url')

const urlFormat = require('url').format

const crypto = require('crypto')

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
  constructor(request, qs, handleUpdate , getRuntime) {
    this.request = request
    this.qs = qs
    this.handleUpdate = handleUpdate
    this.getRuntime = getRuntime
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
    this.pathAppMap[redirect_uri] = { app_id, app_secret, redirect_uri:opts.callbackUrl.replace(/\?$/,''), create_time: Date.now() }

    return `${this.OAUTH2_AUTH_BASE_URL}?${this.qs.stringify(opts)}`;
  }

  //验证code 并获取 credentials
  async getToken(key, code) {
    console.log('rd')

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
      if (expires_in - Date.now() > 86400000) {
        return credentials
      }
      //小于一天 即将到期
      else {
        return await this.refreshAccessToken(credentials)
      }
    }
  }
  //需要用户自主更新
  async refreshAccessToken(credentials) {
    const req = this.getRuntime('req')
    if(req.isAdmin){
      let url = await this.generateAuthUrl(credentials)
      return {error:true , expired:true ,msg:`AccessToken 即将过期<br/><a style="margin:12px  0" href="${url}">请点击此处更新</a>`}
    }else{
      return {error:true , expired:true ,msg:'AccessToken 需要更新，请以管理身份访问此页面操作。'}
    }
  }
}

const error = async (msg, href) => {
  return `
    <div class="auth">
      <h3>挂载 天翼云</h3>
      <p style="font-size:12px;">失败请重试。原因：${msg}</p>
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


    const name = decodeURIComponent(getRuntime('req').path.replace(/^\//g,''))
    let hit = data.filter(i => i.name == name)

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
        pathname: (i.path == '/' || i.path == '' ) ? '/' : i.path,
        slashes:true,
        query:{
          app_secret:c.app_secret,
          redirect_uri:c.redirect_uri,
          access_token:c.access_token,
          expires_in:c.expires_in,
        }
      })
      saveDrive(key , i.name)
    })
  } , getRuntime)

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

    let { path, credentials , expired  } = await getCredentials(id)

    //无 或者 过期
    if( !credentials || (credentials.error && credentials.expired) ){
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

    // 无credentials
    if(!credentials){
      // 挂载验证回调
      if (req.body && req.body.act && req.body.act == 'install') {
        let { app_id, app_secret } = req.body
        if (app_id && app_secret) {
          return {
            id,
            type: 'folder',
            protocol: defaultProtocol,
            redirect: await oauth2.generateAuthUrl({ app_id, app_secret, redirect_uri: baseUrl })
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
      if (credentials.app_id ) {
        if (credentials.access_token) {
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

  const fetch = async (operate = 'GET' , url , credentials , qs) => {
    let date = new Date().toGMTString()
    let signature = hmac(`AccessToken=${credentials.access_token}&Operate=${operate}&RequestURI=${url}&Date=${date}`,credentials.app_secret)

    let headers = {
      AccessToken:credentials.access_token,
      Signature:signature,
      Date:date,
      'content-type':'application/json',
      'accept':'application/json'
    }
    let resp
    try{
      let r = await request({
        url:`https://api.cloud.189.cn${url}`,
        headers,
        method:operate,
        qs, json:true,
        async:true,
      })

      resp = await xml2js(r.body)
      if(resp.error){
        resp.error = resp.error.message[0]
      }
    }catch(e){
      resp = { error:'request error' }
    }

    return resp
    
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
        (Date.now() - r.$cached_at < max_age_dir)

      ) {
        console.log(Date.now()+' CACHE 189Cloud '+ id)
        return r
      }
    }
   
    let qs = { iconOption:1 }

    if(path && path != '/') qs.folderId = path

    let resp = await fetch('GET','/listFiles.action', credentials , qs)

    if (resp.error) {
      return {
        id, type: 'folder', protocol: defaultProtocol,body:resp.error
      }
    }

    let children = [].concat(resp.listFiles.fileList[0].folder || [], resp.listFiles.fileList[0].file || []).map( file => {
      let item = {
        id: createId(credentials.app_id , file.id[0]),
        name: file.name[0],
        protocol: defaultProtocol,
        created_at: file.createDate[0],
        updated_at: file.lastOpTime[0],
        type: file.size ? undefined : 'folder',
      }
      if( item.type != 'folder' ){
        item.ext = file.name[0].split('.').pop()
        item.size = parseInt(file.size[0])
      }

      return item
    })


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

    let r = cache.get(id)
    if (r) {
      if (
        (
          r.$expired_at && Date.now() < r.$expired_at
        )
        || 
        (
          r.$cached_at &&
          r.children &&
          (Date.now() - r.$cached_at < max_age_file)
        )
      ) {
        console.log(Date.now()+' CACHE 189Cloud '+ id)
        return r
      }
    }

    let resp = await fetch('GET','/getFileDownloadUrl.action', credentials , {
      fileId:path,
      short:false, //是否获取短地址
    })

    if(resp.error) {
      return {
        id, type: 'folder', protocol: defaultProtocol,body:resp.error
      }
    }

    let expired_at = parseInt((resp.fileDownloadUrl.match(/(?<=expired=)\d+/) || [0])[0])
    let downloadUrl = resp.fileDownloadUrl
    
    resp = {
      id,
      $cached_at:Date.now(),
      url: downloadUrl,
      name: data.name,
      ext: data.ext,
      protocol: defaultProtocol,
      size:data.size,
      $expired_at:expired_at - 5000
    }

    cache.set(id, resp)

    return resp
  }

  const createReadStream = async ({id , size , options = {}} = {}) => {
    let resp = await file(id)
    if(resp.body){
      return resp
    }else{
      let readstream = request({url:resp.url , method:'get'})
      return wrapReadableStream(readstream , { size: size } )
    }
  }

  return { name, label:'天翼云 API版', version, drive: { protocols, folder, file , createReadStream  } }
}