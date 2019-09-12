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
    this.GOOGLE_OAUTH2_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    this.GOOGLE_OAUTH2_TOKEN_URL = "https://oauth2.googleapis.com/token"
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

    return `${this.GOOGLE_OAUTH2_AUTH_BASE_URL}?${this.qs.stringify(opts)}`;
  }

  //验证code 并获取 credentials
  async getToken(key, code) {
    let appConfig = this.pathAppMap[key]

    if (!appConfig) return { error: true, msg: '没有匹配到app_id' }

    let { client_id, client_secret, redirect_uri } = appConfig
    let params = {
      client_id,
      client_secret,
      redirect_uri,
      code,
      grant_type: 'authorization_code'
    }

    let resp
    try {
      resp = await this.request.post(this.GOOGLE_OAUTH2_TOKEN_URL, params, { json: true })
    } catch (e) {
      resp = e
    }

    if (resp.body && !resp.body.error) {
      let { refresh_token, expires_in, access_token } = resp.body

      this.clientMap[client_id] = { client_id, client_secret, redirect_uri, refresh_token, expires_in, access_token , update_time:Date.now() }
      delete this.pathAppMap[key]

      console.log('get token success')

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
        let resp = await this.request.post(this.GOOGLE_OAUTH2_TOKEN_URL, params, { json: true })
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
        return false
      }
    }
    return false
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
      <p style="font-size:12px;"><a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" href="https://developers.google.com/drive/api/v3/quickstart/nodejs">访问此链接</a>创建应用，获取 应用机密 和 应用ID。</p>

      <p style="font-size:12px;">或者 上传json凭证。 <input type="file" onchange="readFile(this)" /></p>

      <form class="form-horizontal" method="post">
        <input type="hidden" name="act" value="install" />
        <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
        <div class="form-group"><input id="j_client_secret" class="sl-input" type="text" name="client_secret" placeholder="应用机密 / client_secret" /></div>
        <div class="form-group"><input id="j_client_id" class="sl-input" type="text" name="client_id" placeholder="应用ID / client_id" /></div>
        <button class="sl-button btn-primary" id="signin" type="submit">验证</button>
      </form>
      <script>
        function readFile(input){
          if (window.FileReader) {
            var file = input.files[0];
            filename = file.name.split(".")[0];
            var reader = new FileReader();
            reader.onload = function() {
              try{
                var d = JSON.parse( this.result );
                var client_id = d.installed.client_id;
                var client_secret = d.installed.client_secret;
                document.querySelector('#j_client_id').value = client_id;
                document.querySelector('#j_client_secret').value = client_secret;
              }catch(e){
                alert('文件无效')
              }
            }
            reader.readAsText(file,"UTF-8");
          }
        }
      </script>
    </div>
  `
}

const parseCredentials = ({name,path}) => {
  let [rootPath, cstr = ''] = path.split('->')
  let [client_id, client_secret, refresh_token, redirect_uri] = cstr.split('|')
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
module.exports = ({ request, cache, getConfig, querystring, base64, saveDrive, getDrive, getDrives }) => {

  const oauth2 = new oauth2ForGD(request, querystring , async (c) => {
    let paths = await getDrives()
    paths
      .map(i => parseCredentials(i))
      .filter(i => i.credentials.client_id == c.client_id)
      .forEach(i => {
        let key = `${i.protocol}:${i.path}->${c.client_id}|${c.client_secret}|${c.refresh_token}|${c.redirect_uri}`
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
    let [fid, client_id] = id.split('->')
    client_id = client_id.split('|')[0]
    if (client_id) {
      let credentials = await oauth2.getCredentials(client_id)
      if (credentials) {
        return [fid, credentials]
      }
    }
    return [fid]
  }

  const prepare = async (id, { req }) => {
    let baseUrl = req.origin + req.path

    let [path, credentials] = await getCredentials(id)
    //credentials有效
    if (credentials) {
      if( credentials.refresh_token )
        return { path, credentials }
    }
    // 挂载验证
    if (req.body && req.body.act && req.body.act == 'install') {
      let { client_id, client_secret } = req.body
      if (client_id && client_secret) {
        return {
          id,
          type: 'folder',
          protocol: defaultProtocol,
          redirect: await oauth2.generateAuthUrl({ client_id, client_secret, redirect_uri: baseUrl })
        }
      }

      return await error()
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

    // 
    if (credentials && credentials.client_id) {
      return {
        id,
        type: 'folder',
        protocol: defaultProtocol,
        redirect: await oauth2.generateAuthUrl({ ...credentials, redirect_uri: baseUrl })
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

  // 无临时链接 强制中转
  const file = async (id, options) => {
    let predata = await prepare(id, options)

    if (!predata.credentials) return predata

    let { path, credentials } = predata

    let data = options.data

    let api = `https://www.googleapis.com/drive/v3/files/${path}?alt=media`

    /*let resp = await request.get(api, {
      headers: {
        'Authorization': `Bearer ${accessConfig.access_token}`,
      }
    })*/

    // let url = baseUrl + encodeURI(path)
    return {
      url: api,
      name: data.name,
      ext: data.ext,
      protocol: defaultProtocol,
      proxy: true,
      // outputType: stream,
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
      }
    }
  }

  const folder = async (id, options) => {
    console.log('-->',id)
    let predata = await prepare(id, options)

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

  return { name, version, drive: { protocols, folder, file } }
}
