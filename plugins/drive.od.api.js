/*
 * One Drive API
 * 使用官方API挂载
 */

const name = 'OneDriveAPI'

const version = '1.0'

const protocols = ['oda']

const defaultProtocol = 'oda'

const fs = require('fs')

const path = require('path')

const { PassThrough } = require('stream')

const onedrive_max_age_dir = 3600 * 1000 * 0.9

const chunkStream  = require('../app/utils/chunkStream')

const isSecretUrl = (url) => {
  return !(url.includes('://localhost') == false && url.startsWith('https') == false)
}

class oauth2ForOD {
  constructor(request, qs, handleUpdate) {
    this.request = request
    this.qs = qs
    this.handleUpdate = handleUpdate

    this.clientMap = {}
    this.pathAppMap = {}

    this.SCOPES = ['offline_access','files.readwrite.all'];
    this.OAUTH2_AUTH_BASE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    this.OAUTH2_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    this.PROXY_URL = 'https://reruin.github.io/redirect/onedrive.html'
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
      client_id,
      scope: this.SCOPES.join(' '),
      // access_type: 'offline',
      // prompt:'consent',
      response_type: 'code',
      redirect_uri
    };

    if(!isSecretUrl(redirect_uri)){
      opts.redirect_uri = this.PROXY_URL
      opts.state = redirect_uri
    }

    this.pathAppMap[redirect_uri] = { client_id, client_secret, redirect_uri:opts.redirect_uri, create_time: Date.now() }

    return `${this.OAUTH2_AUTH_BASE_URL}?${this.qs.stringify(opts)}`;
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
    console.log('getToken',params)
    let resp
    try {
      resp = await this.request.post(this.OAUTH2_TOKEN_URL, params, { json: true })
    } catch (e) {
      resp = e
    }

    if(!resp.body) return { error: true, msg: '没有收到返回结果。' }

    if (!resp.body.error) {
      let { refresh_token, expires_in, access_token } = resp.body

      this.clientMap[client_id] = { client_id, client_secret, redirect_uri, refresh_token, expires_in, access_token , update_time:Date.now() }
      delete this.pathAppMap[key]
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
        redirect_uri, 
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

  async createAppLink(redirect_uri){
    //非安全域名 添加中转
    if(!isSecretUrl(redirect_uri)){
      redirect_uri = this.PROXY_URL
    }

    let ru = `https://developer.microsoft.com/en-us/graph/quick-start?appID=_appId_&appName=_appName_&redirectUrl=${redirect_uri}&platform=option-node`
    let deepLink = `/quickstart/graphIO?publicClientSupport=false&appName=sharelist&redirectUrl=${redirect_uri}&allowImplicitFlow=false&ru=` + encodeURIComponent(ru)
    let app_url = "https://apps.dev.microsoft.com/?deepLink=" + encodeURIComponent(deepLink)

    return app_url
  }
}

const error = async (msg, href) => {

  return `
    <div class="auth">
      <h3>挂载 OneDrive 失败</h3>
      <p style="font-size:12px;">${msg}</p>
      <p style="font-size:12px;"><a style="font-size:12px;margin-right:5px;color:#337ab7;" href="${href}">点此重新开始</a></p>
    </div>
  `
}

const install = async (redirect_uri , createLink) => {
  const isSecret = !isSecretUrl(redirect_uri) ? '<p>当前地址不符合OneDrive安全要求，故采用<a target="_blank" href="https://github.com/reruin/reruin.github.io/blob/master/redirect/onedrive.html">页面中转</a>验证</p>' : ''
  return `
    <div class="auth">
      <h3>OneDrive 挂载向导</h3>
      <p style="font-size:12px;"><a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" href="${createLink}">访问此链接</a>获取 应用机密 和 应用ID。请注意：个人账号需前往 <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;">Azure管理后台</a> 注册应用才能获取应用机密 和 应用ID。</p>
      <div>
        <form class="form-horizontal" method="post">
          <input type="hidden" name="act" value="install" />
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <div class="form-group"><input class="sl-input" type="text" name="client_secret" value="" placeholder="应用机密 / app_secret" /></div>
          <div class="form-group"><input class="sl-input" type="text" name="client_id" value="" placeholder="应用ID / app_id" /></div>
          <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
      </div>
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
      client_secret:client_secret ? decodeURIComponent(client_secret) : client_secret,
      refresh_token,
      redirect_uri
    }
  }
}

module.exports = ({ request, cache, getConfig, querystring, base64 , saveDrive , getDrive,getDrives, extname , getRuntime , pathNormalize , }) => {

  const oauth2 = new oauth2ForOD(request, querystring , async (c) => {
    let paths = await getDrives()
    let data = paths
      .map(i => parseCredentials(i))

    //是否有其他配置参数
    //let hit = data.filter(i => i.credentials.client_id == c.client_id)

    //无配置参数匹配路径名
    //if( hit.length == 0 ){
    const name = decodeURIComponent(getRuntime('req').path.replace(/^\//g,''))
    let hit = data.filter(i => i.name == name)
    //}
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
    
    const baseUrl = req.origin + req.path

    let { path, credentials } = await getCredentials(id)

    // 无credentials
    if(!credentials){
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
      if (credentials.client_id && credentials.client_secret && credentials.redirect_uri) {
        if (credentials.refresh_token) {
          return { path, credentials }
        }
        // 缺少 refresh_token 跳转至验证页面
        else{
          return {
            id,
            type: 'folder',
            protocol: defaultProtocol,
            redirect: await oauth2.generateAuthUrl(credentials)
          }
        }
      }
    }

    //finally 开始挂载向导
    let createLink = await oauth2.createAppLink(baseUrl)
    return {
      id,
      type: 'folder',
      protocol: defaultProtocol,
      body: await install(baseUrl , createLink)
    }
  }


  // https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/resources/driveitem?view=odsp-graph-online
  // There are two primary ways of addressing a driveItem resource:

  // By the driveItem unique identifier using drive/items/{item-id}
  // By file system path using /drive/root:/path/to/file
  const folder = async (id) => {
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
        (Date.now() - r.$cached_at < onedrive_max_age_dir)

      ) {
        console.log('get OneDrive folder from cache' , resid)
        return r
      }
    }

    let api = 'https://graph.microsoft.com/v1.0' + ((!path || path == '/') ? `/me/drive/root/` : `/me/drive/items/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`) + 'children'

    let resp = await request.get(api, {
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json'
      },
      qs: {
        select:'id,name,size,file,folder,@microsoft.graph.downloadUrl,thumbnails,createdDateTime,lastModifiedDateTime',
        top:999999
      },
      json: true
    })

    if (!resp.body) return false
    if (resp.body && resp.body.error) return false

    const ts = Date.now()
    let children = resp.body.value.map((i) => {
      return {
        id: (path+'/'+i.name).replace(/\/{2,}/g,'/')+'->' + credentials.client_id,
        fid:i.id,
        name: i.name,
        ext: extname(i.name),
        protocol: defaultProtocol,
        size: i.size,
        created_at: i.createdDateTime,
        updated_at: i.lastModifiedDateTime,
        url:i['@microsoft.graph.downloadUrl'],
        type: i.folder ? 'folder' : 'other',
        $cached_at:ts
      }
    })

    let result = { id:path + '->' + credentials.client_id, path, type: 'folder', protocol: defaultProtocol }
    result.$cached_at = Date.now()
    result.children = children
    cache.set(resid, result)
    console.log('cache save',resid)
    return result
  }

  const file = async (id, { data = {} } = {}) => {
    let predata = await prepare(id)

    if (!predata.credentials) return predata

    let { path, credentials } = predata

    if(
      data && 
      data.url &&
      data.$cached_at && 
      ( Date.now() - data.$cached_at < onedrive_max_age_dir)
    ){
      console.log('get od download url from upstream')
      return data
    }


    let api = `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`

    let resp = await request.get(api , {headers:{
      'Authorization':`bearer ${credentials.access_token}`,
      'Content-Type': 'application/json'
    },json:true})
    if(resp.body){
      data = {
        id: id,
        fid:resp.body.id,
        name: resp.body.name,
        protocol: defaultProtocol,
        size: resp.body.size,
        created_at: resp.body.createdDateTime,
        updated_at: resp.body.lastModifiedDateTime,
        ext: extname(resp.body.name),
        url:resp.body['@microsoft.graph.downloadUrl'],
        type: resp.body.folder ? 'folder' : 'other',
      }
      if(!data.url && resp.body.webUrl){
        data.type = 'redirect'
        data.redirect = resp.body.webUrl
      }
      return data
    }

    return false
  }

  const mkdir = async (path , target, credentials) => {
    let children = target.replace(/(^\/|\/$)/g,'').split('/')

    //无需创建
    if(children.length <=1 ) return true

    //递归创建
    for(let i = 0; i < children.length - 1; i++){
      let p = path + children.slice(0,i)
      let npath = (!p || p == '/') ? '/me/drive/root/children' : `/me/drive/items/root:${encodeURIComponent(p).replace(/\/+$/g,'/')}:/children`

      ///me/drive/root/children

      // https://graph.microsoft.com/v1.0/me/drive/root/children
      let api = 'https://graph.microsoft.com/v1.0' + npath
      let resp = {}
      
      try{
        resp = await request.post(api,{
          "name":children[i],
          "folder":{},
          "@microsoft.graph.conflictBehavior": "fail"
        },{
          headers:{
            'Authorization':`bearer ${credentials.access_token}`,
          }, 
          json:true,
          is_body:true
        })
      }catch(e){
        resp = e.body
      }
      // 409 文件夹已存在
      if(resp && resp.error){
        console.log('info:',resp.error.message)
        //return false
      }else{
        console.log(resp)
        console.log('mkdir error')
      }
    }

    return true

  }


  const request_fix = (...rest) => {
    let req = request(...rest)
    // request 作为 writestream 时不会emit finish
    req.on('end' ,function(){
      this.emit('finish')
    })
    return req
  }

  /*
   * 创建分块上传流
   *
   */
  const createChunkStream = ( url , size , offset = 0, chunkSize , retry = 3) => {
    let currentChunkSize = ( size - offset < chunkSize ) ? (size - offset) : chunkSize
    console.log('create',`bytes ${offset}-${offset+currentChunkSize-1}/${size}` , 'retry:',3-retry)

    let req = request({
      url:url, 
      method:'put' , 
      headers:{
        'Content-Length':currentChunkSize,
        'Content-Range':`bytes ${offset}-${offset+currentChunkSize-1}/${size}`,
        'Content-Type': 'application/json'
      },
      json:true
    },function(error, response, body) {
      // retry
      if(error) {
        console.log(`error bytes(${retry}) ${offset}-${offset+currentChunkSize-1}/${size}` , error)

        if(retry > 0){
          // return 
          this.emit('retry' , { retry:retry-1 ,  offset })
        }else{
          this.emit('fail' , {error:true , msg:error})
        }
      }
      else {
        console.log(`finish bytes ${offset}-${offset+currentChunkSize-1}/${size}`)

        if(body.error){

          if(retry > 0){
            this.emit('retry' , { retry:retry-1 ,  offset })
          }else{
            this.emit('fail' , {error:true , msg:JSON.stringify(body.error)})
          }
        }else{
          this.emit('finish' , body)
        }
      }
    })

    return req
  }

  const createRangeStream = ({url , chunkSize , size}) => {

    //只读流会通过整理后 进入 req，并在req异常时 重试
    let stream = chunkStream(createChunkStream(url , size , 0 , chunkSize) , {chunkSize , size} )

    stream.on('update' , (offset, resp) => {
      if(resp.error){
        return { error: resp.msg }
      }else{
        // successd return {id , ...}
        if(resp.id){
          // console.log('finish' , resp.id)
          stream.finish(resp)
        }else{
          stream.next( createChunkStream(url , size , offset , chunkSize) )
        }
      }
    })

    stream.on('retry' , ({ retry, offset }) => {
      stream.retry( createChunkStream(url , size , offset , chunkSize , retry) )
    })

    stream.on('error' , (err) => {
      console.log('stream said: error',err)
    })

    stream.on('finish' , (err) => {
      console.log('stream said: finish')
    })

    return stream
  }

  const uploadLargeFile = async (path , size , credentials) => {
    let p = path.split('/')

    let name = decodeURIComponent( p.pop() )

    let api = 'https://graph.microsoft.com/v1.0' + ((!path || path == '/') ? `/me/drive/root/` : `/me/drive/items/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`) + 'createUploadSession'
   // api = 'https://graph.microsoft.com/v1.0/me/drive/items/root:/Amlogic USB Burning Tool_v2.1.6.8.zip:/createUploadSession'

    let resp
    try{
      resp = await request({
        url:api,
        method:'post',
        body:{
          "item": {
            "@microsoft.graph.conflictBehavior": "rename",
            "name":name
          }
        },
        headers:{
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json'
        },
        json:true,
        async:true
      })

    }catch(e){
      resp = { error: e }
    }
    
    if( resp.error ){
      console.log('error',resp.error)
      return { error : true , msg: resp.error }
    }else if(resp.body && resp.body.uploadUrl){
      console.log('Start Upload : '+resp.body.uploadUrl)
      // chunkSize = n * 327680 , n ∈ N
      return createRangeStream({url : resp.body.uploadUrl , chunkSize:10485760 , size})
    }
  }

  // size < 4MB
  const upload = async (path , credentials) => {
    let api = 'https://graph.microsoft.com/v1.0' + ((!path || path == '/') ? `/me/drive/root/` : `/me/drive/items/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`) + 'content'

    let req = request_fix({
      url:api , 
      method:'put',
      headers:{
        'Authorization':`bearer ${credentials.access_token}`,
      }
    })
    return req
    //passThroughtStream.pipe(req)
  }

  const createReadStream = async ({id , options = {}} = {}) => {
    let predata = await prepare(id)

    if (!predata.credentials) return { error: true , msg: 'OneDriveAPI: Can not get upload url'}

    let { path, credentials } = predata

    let api = `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`

    let resp = await request.get(api , {headers:{
      'Authorization':`bearer ${credentials.access_token}`,
      'Content-Type': 'application/json'
    },json:true})

    if(resp.body){
      let downloadUrl = resp.body['@microsoft.graph.downloadUrl']
      return request({url:downloadUrl , method:'get'})
    }else{
      return { error : true , msg: 'OneDriveAPI: Can not get upload url' }
    }
  }

  
  // id 当前有效路径
  // target 后续实际路径
  const createWriteStream = async ({ id , size , type , name,  target = ''} = {}) => {
    let predata = await prepare(id)
    if (!predata.credentials) return null
    let { path:filepath, credentials } = predata

    //为path 创建目的地目录
    await mkdir(filepath , target , credentials)


    let paths = [filepath,target]
    if( type == 'folder' ){
      paths.push(name)
    }
    let fullpath = pathNormalize(paths.join('/'))

    console.log(fullpath)
    if( size !== undefined ){
      cache.clear(`${defaultProtocol}:${id}`)
      if( size <= 4194304 ){
        return await upload(fullpath , credentials)
      }else{
        return await uploadLargeFile(fullpath , size , credentials)
      }
    }else{
      console.log('无法解析文件大小')
      return { error:true , msg:'无法解析文件大小'}
    }

  }

  return { name, label:'OD API版',version, drive: { protocols, folder, file , createReadStream , createWriteStream } }
}