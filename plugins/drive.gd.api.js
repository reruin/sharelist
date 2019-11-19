/*
 * Google Drive API
 * 使用官方API挂载
 * 有效字段
 * ["kind", "id", "name", "mimeType", "description", "starred", "trashed", "explicitlyTrashed", "trashingUser", "trashedTime", "parents", "properties", "appProperties", "spaces", "version", "webContentLink", "webViewLink", "iconLink", "hasThumbnail", "thumbnailLink", "thumbnailVersion", "viewedByMe", "viewedByMeTime", "createdTime", "modifiedTime", "modifiedByMeTime", "modifiedByMe", "sharedWithMeTime", "sharingUser", "owners", "teamDriveId", "lastModifyingUser", "shared", "ownedByMe", "capabilities", "viewersCanCopyContent", "writersCanShare", "hasAugmentedPermissions", "folderColorRgb", "originalFilename", "fullFileExtension", "fileExtension", "md5Checksum", "size", "quotaBytesUsed", "headRevisionId", "contentHints", "imageMediaMetadata", "videoMediaMetadata", "isAppAuthorized"]
 */

const name = 'GoogleDriveAPI'

const version = '1.0'

const protocols = ['gda']

const defaultProtocol = 'gda'

const googledrive_max_age_dir = 600 * 1000

class oauth2ForGD {
  constructor(request, qs, handleUpdate) {
    this.request = request
    this.qs = qs
    this.handleUpdate = handleUpdate

    this.clientMap = {}
    this.pathAppMap = {}

    this.SCOPES = ['https://www.googleapis.com/auth/drive'];
    this.OAUTH2_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    this.OAUTH2_TOKEN_URL = "https://oauth2.googleapis.com/token"
  }

  init(data) {
    for(let { path ,credentials } of data){
      let { client_id , client_secret , refresh_token , redirect_uri} = credentials
      if( client_id ){
        this.clientMap[client_id] = { 
          client_id, client_secret, refresh_token,redirect_uri,
          update_time:0,
          expires_in:0
        }
      }
    }
  }

  async generateAuthUrl(config) {
    const { client_id, client_secret, redirect_uri } = config

    const opts = {
      access_type: 'offline',
      scope: this.SCOPES.join(" "),
      // prompt:'consent',
      response_type: 'code',
      client_id,
      redirect_uri
    };

    this.pathAppMap[redirect_uri] = { client_id, client_secret, redirect_uri, create_time: Date.now() }

    return `${this.OAUTH2_AUTH_BASE_URL}?${this.qs.stringify(opts)}`;
  }

  //验证code 并获取 credentials
  async getToken(key, code) {
    let appConfig = this.pathAppMap[key]

    if (!appConfig) return { error: true, msg: '没有匹配到app_id' }

    let { client_id, client_secret, redirect_uri } = appConfig

    return await authToken({ client_id, client_secret, redirect_uri , code },key)
  }

  async authToken({client_id, client_secret, redirect_uri , code} , key){
    let params = {
      client_id,
      client_secret,
      redirect_uri,
      code,
      grant_type: 'authorization_code'
    }
    let resp
    try {
      resp = await this.request.post(this.OAUTH2_TOKEN_URL, params, { json: true })
    } catch (e) {
      resp = e
    }

    if (resp.body && !resp.body.error) {
      let { refresh_token, expires_in, access_token } = resp.body

      this.clientMap[client_id] = { client_id, client_secret, redirect_uri, refresh_token, expires_in, access_token , update_time:Date.now() }
      if(key) delete this.pathAppMap[key]
      await this.handleUpdate(this.clientMap[client_id])

      return this.clientMap[client_id]
    } else {
      return { error: true, msg: resp.body ? resp.body.error_description : 'unknow error' }
    }
  }

  async getCredentials(client_id) {
    let credentials = this.clientMap[client_id]
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
    let { client_id, client_secret, redirect_uri, refresh_token } = credentials
    if (client_id && client_secret /*&& redirect_uri*/ && refresh_token) {

      let params = {
        client_id,
        client_secret,
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
          this.clientMap[client_id] = credentials
          await this.handleUpdate(this.clientMap[client_id])
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
      <h3>挂载 GoogleDrive 失败</h3>
      <p style="font-size:12px;">失败请重试。原因：${msg}</p>
      <p style="font-size:12px;"><a style="font-size:12px;margin-right:5px;color:#337ab7;" href="${href}">点此重新开始</a></p>
    </div>
  `
}

const install = async (client_id, client_secret, redirect_uri) => {
  return `
    <div class="auth">
      <h3>挂载GoogleDrive</h3>
      <p style="font-size:12px;">1. <a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" href="https://developers.google.com/drive/api/v3/quickstart/nodejs">访问此链接</a>点击 [Enable the Drive API] 按钮，获取 credentials.json。如果你已有凭证请从第二步开开始。</p>

      <p style="font-size:12px;">2. 上传json凭证。 <input type="file" onchange="readFile(this)" /></p>
      <p style="font-size:12px;">3. <a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" id="j_code_link"  onclick="directToCodeUrl(this)"> 获取验证code</a>。 </p>

      <form class="form-horizontal" method="post">
        <input type="hidden" name="act" value="quick_install" />
        <input type="hidden" name="redirect_uri" id="j_direct_uri" value="${redirect_uri}" />
        <div class="form-group"><input id="j_client_secret" class="sl-input" type="text" name="client_secret" placeholder="应用机密 / client_secret" /></div>
        <div class="form-group"><input id="j_client_id" class="sl-input" type="text" name="client_id" placeholder="应用ID / client_id" /></div>
        <div class="form-group"><input id="j_code" class="sl-input" type="text" name="code" placeholder="验证code" /></div>
        <button class="sl-button btn-primary" id="signin" type="submit">验证</button>
      </form>
      <script>
        var codeUrl;
        function readFile(input){
          if (window.FileReader) {
            var file = input.files[0];
            filename = file.name.split(".")[0];
            var reader = new FileReader();
            reader.onload = function() {
              try{
                var d = JSON.parse( this.result );
                var data = Object.values(d)[0]
                var client_id = data.client_id;
                var client_secret = data.client_secret;
                var redirect_uris = data.redirect_uris;

                var hit = redirect_uris.find(function(i){
                  return  i.indexOf('urn:ietf') == 0
                })

                document.querySelector('#j_client_id').value = client_id;
                document.querySelector('#j_client_secret').value = client_secret;

                if(hit){
                  codeUrl = "https://accounts.google.com/o/oauth2/auth?client_id="+client_id+"&redirect_uri="+hit+"&response_type=code&access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&approval_prompt=auto";

                  document.querySelector('#j_direct_uri').value = hit;
                }
                
              }catch(e){
                console.log(e)
                alert('文件无效')
              }
            }
            reader.readAsText(file,"UTF-8");
          }
        }

        function directToCodeUrl(el){
          if(codeUrl){
            window.open(codeUrl)
          }else{
            alert('请上传凭证')
          }
        }
      </script>
    </div>
  `
}

const parseCredentials = ({name,path}) => {
  let [rootPath, cstr = ''] = path.split('->')
  let [client_id, client_secret, redirect_uri, refresh_token] = cstr.split('|')
  return {
    name,
    protocol:rootPath.split(':')[0],
    path: rootPath.replace(/^[^\:]+\:/,''),
    credentials: {
      client_id,
      client_secret,
      refresh_token,
      redirect_uri
    }
  }
}
// fileid->app_credentials
module.exports = ({ request, cache, getConfig, querystring, base64, saveDrive, getDrive, getDrives , getRuntime , wrapReadableStream}) => {

  const oauth2 = new oauth2ForGD(request, querystring , async (c) => {
    let paths = await getDrives()
    let data = paths
      .map(i => parseCredentials(i))


    //是否有其他配置参数
    let hit = data.filter(i => i.credentials.client_id == c.client_id)

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
      let key = `${i.protocol}:${i.path}->${c.client_id}|${encodeURIComponent(c.client_secret)}|${c.redirect_uri}|${c.refresh_token}`
      saveDrive(key , i.name)
    })
  })

  //获取所有相关根目录，并创建凭证
  getDrives().then(resp => {
    let credentials = resp.map(i => parseCredentials(i))
    oauth2.init(credentials)
  })

  const getCredentials = async (id) => {
    // TODO 待解决嵌套情形
    // /app1/app1_path/app2/app2_path/app2_file
    // app2_file->app2_credentials
    let [path, client] = id.split('->')
    let ret = { path }
    if (client) {
      client_id = client.split('|')[0]
      ret.credentials = await oauth2.getCredentials(client_id)
    }
    return ret
  }

  const prepare = async (id) => {
    const req = getRuntime('req')

    let baseUrl = req.origin + req.path

    let { path, credentials } = await getCredentials(id)

    // 无credentials
    if(!credentials){
      //使用 client_id, client_secret, code , redirect_uri 快速挂载
      if( req.body && req.body.act && req.body.act == 'quick_install'){
        let { client_id, client_secret, code , redirect_uri } = req.body
        if (client_id && client_secret && code && redirect_uri) {
          let credentials = await oauth2.authToken({client_id, client_secret, code , redirect_uri})
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

      if (req.body && req.body.act && req.body.act == 'install') {
        let { client_id, client_secret, proxy_url } = req.body
        if (client_id && client_secret) {
          return {
            id,
            type: 'folder',
            protocol: defaultProtocol,
            redirect: await oauth2.generateAuthUrl({ client_id, client_secret, redirect_uri: baseUrl })
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
      if (credentials.client_id && credentials.client_secret) {
        if (credentials.refresh_token) {
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

  const folder = async (id, options) => {

    let predata = await prepare(id)

    if (!predata.credentials) return predata

    let { path, credentials } = predata

    id = `${path}->${credentials.client_id}`

    let resid = `${defaultProtocol}:${id}`

    let r = cache.get(resid)
    if (r) {
      if (
        r.$cached_at &&
        r.children &&
        (Date.now() - r.$cached_at < googledrive_max_age_dir)

      ) {
        console.log('get google folder from cache')
        return r
      }
    }
    let api = 'https://www.googleapis.com/drive/v3/files'

    if (path == '/') path = 'root'

    let resp = await request.get(api, {
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        // 'Content-Type': 'application/json'
      },
      qs: {
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: 1000,
        fields: `nextPageToken, files(id,name,mimeType,size,fileExtension,modifiedTime)`,
        q: `trashed = false and '${path}' in parents`,
      },
      json: true
    })
    if (resp.body.error) return false

    let files = resp.body.files
    let children = files.map((file) => {
      return {
        id: file.id + '->' + credentials.client_id,
        name: file.name,
        ext: file.fileExtension,
        protocol: defaultProtocol,
        // parent:i[1][0],
        mime: file.mimeType,
        created_at: file.modifiedTime,
        updated_at: file.modifiedTime,
        size: parseInt(file.size),
        type: file.mimeType.indexOf('.folder') >= 0 ? 'folder' : undefined,
      }
    })

    //缓存 pathid(fid->appid)  <=> path
    //cache.set(baseUrl , id)
    // console.log(children)
    let result = { path, type: 'folder', protocol: defaultProtocol }
    result.$cached_at = Date.now()
    result.children = children
    
    cache.set(resid, result)

    return result
  }

  // 无临时链接 强制中转
  const file = async (id, options) => {
    let predata = await prepare(id)

    if (!predata.credentials) return predata

    let { path, credentials } = predata

    let data = options.data || {}

    let api = `https://www.googleapis.com/drive/v3/files/${path}?alt=media`

    return {
      id,
      url: api,
      name: data.name,
      ext: data.ext,
      protocol: defaultProtocol,
      proxy: true,
      size:data.size,
      // outputType: stream,
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
      }
    }
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

  return { name, version, drive: { protocols, folder, file , createReadStream } }
}
