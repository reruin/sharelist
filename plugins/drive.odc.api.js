/*
 * One Drive CN API
 * 使用官方API挂载
 */

const name = 'OneDriveCNAPI'

const version = '1.0'

const protocols = ['odc']

const defaultProtocol = 'odc'

const fs = require('fs')

const path = require('path')

const { PassThrough } = require('stream')

const onedrive_max_age_dir = 3600 * 1000 * 0.9

const { URL } = require('url')

const urlFormat = require('url').format


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
    this.OAUTH2_AUTH_BASE_URL = 'https://login.partner.microsoftonline.cn/common/oauth2/authorize'
    this.OAUTH2_TOKEN_URL = 'https://login.partner.microsoftonline.cn/common/oauth2/token'
    this.PROXY_URL = 'https://reruin.github.io/redirect/onedrive.html'
  }

  init(data) {
    for(let { path ,credentials } of data){
      let { client_id , client_secret , refresh_token , redirect_uri , tenant } = credentials
      if( client_id ){
        this.clientMap[client_id] = { 
          client_id, client_secret, refresh_token,redirect_uri,tenant,
          update_time:0,
          expires_in:0
        }
      }
    }
  }

  async generateAuthUrl(config) {
    let { client_id, client_secret, tenant, redirect_uri } = config

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
      //redirect_uri = this.PROXY_URL
    }

    this.pathAppMap[redirect_uri] = { client_id, client_secret, tenant, redirect_uri:opts.redirect_uri, create_time: Date.now() }

    return `${this.OAUTH2_AUTH_BASE_URL}?${this.qs.stringify(opts)}`;
  }

  //验证code 并获取 credentials
  async getToken(key, code) {
    let appConfig = this.pathAppMap[key]
    if (!appConfig) return { error: true, msg: '没有匹配到app_id. key:'+key }

    let { client_id, client_secret, tenant, redirect_uri } = appConfig

    return await this.authToken({ client_id, client_secret, tenant, redirect_uri , code },key)
  }

  async authToken({client_id, client_secret, tenant, redirect_uri , code} , key){
    let params = {
      client_id,
      client_secret,
      redirect_uri,
      code,
      resource:`https://${tenant}-my.sharepoint.cn`,
      grant_type: 'authorization_code'
    }
    let resp
    try {
      resp = await this.request.post(this.OAUTH2_TOKEN_URL, params, { json: true })
    } catch (e) {
      console.log(e)
      resp = e
    }

    if(!resp.body) return { error: true, msg: '没有收到返回结果。' }

    if (resp.body && !resp.body.error) {
      let { refresh_token, expires_in, access_token } = resp.body

      this.clientMap[client_id] = { client_id, client_secret, tenant, redirect_uri, refresh_token, expires_in, access_token , update_time:Date.now() }
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
    let { client_id, client_secret, redirect_uri, refresh_token , tenant } = credentials
    if (client_id && client_secret /*&& redirect_uri*/ && refresh_token) {

      let params = {
        client_id,
        client_secret,
        redirect_uri, 
        refresh_token,
        resource:`https://${tenant}-my.sharepoint.cn`,
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
      <p style="font-size:12px;">前往 <a href="https://portal.azure.cn/?whr=azure.com#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps" target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;">Azure管理后台</a> 注册应用获取应用机密 和 应用ID。</p>
      <div>
        <form class="form-horizontal" method="post">
          <input type="hidden" name="act" value="install" />
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <div class="form-group"><input class="sl-input" type="text" name="client_secret" value="" placeholder="应用机密 / app_secret" /></div>
          <div class="form-group"><input class="sl-input" type="text" name="client_id" value="" placeholder="应用ID / app_id" /></div>
          <div class="form-group"><input class="sl-input" type="text" name="tenant" value="" placeholder="组织名 / tenant" /></div>
          <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
      </div>
    </div>
  `
}

const parseCredentials = ({name,path}) => {
  let data = new URL(path)
  let credentials = { client_id : data.host }
  for (const [key, value] of data.searchParams) {
    credentials[key] = value
  }
  return {
    name,
    protocol:data.protocol.split(':')[0],
    path: decodeURIComponent(data.pathname), //.replace(/^\//,''),
    credentials
  }
}

const createId = (client_id , path) => {
  return urlFormat({
    protocol: defaultProtocol,
    slashes:true,
    hostname: client_id,
    pathname: path,
  })
}

module.exports = ({ request, cache, getConfig, querystring, base64 , saveDrive , getDrive,getDrives, extname , getRuntime , pathNormalize, chunkStream}) => {

  const oauth2 = new oauth2ForOD(request, querystring , async (c) => {
    let paths = await getDrives()
    let data = paths
      .map(i => parseCredentials(i))


    //是否有其他配置参数
    //let hit = data.filter(i => i.credentials.client_id == c.client_id && i.credentials.client_secret == c.client_secret)

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

    console.log('update hit',hit)
    hit.forEach(i => {
      let key = urlFormat({
        protocol: i.protocol,
        hostname: c.client_id,
        pathname: (i.path == '/' || i.path == '' ) ? '/' : i.path,
        slashes:true,
        query:{
          client_secret:c.client_secret,
          redirect_uri:c.redirect_uri,
          tenant:c.tenant,
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
    let ret = { path : decodeURIComponent(data.pathname) }
    let client_id = data.host
    
    if (client_id) {
      let credentials = await oauth2.getCredentials(client_id)
      if(credentials){
        ret.credentials = credentials
      }
    }

    return ret
  }


  const prepare = async (id) => {
    if(!id.startsWith(defaultProtocol)){
      id = defaultProtocol + ':' + id
    }
    const req = getRuntime('req')
    
    const baseUrl = req.origin + req.path

    let { path, credentials } = await getCredentials(id)
    console.log('prepare -->',id)
    // 无credentials
    if(!credentials){
      if (req.body && req.body.act && req.body.act == 'install') {
        let { client_id, client_secret, tenant, proxy_url } = req.body
        if (client_id && client_secret && tenant) {
          console.log('redirect')
          return {
            id,
            type: 'folder',
            protocol: defaultProtocol,
            redirect: await oauth2.generateAuthUrl({ client_id, client_secret, tenant, redirect_uri: baseUrl })
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
      if (credentials.client_id && credentials.client_secret && credentials.tenant && credentials.redirect_uri) {
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
    return {
      id,
      type: 'folder',
      protocol: defaultProtocol,
      body: await install(baseUrl)
    }
  }


  // https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/resources/driveitem?view=odsp-graph-online
  // There are two primary ways of addressing a driveItem resource:

  // By the driveItem unique identifier using drive/items/{item-id}
  // By file system path using /drive/root:/path/to/file
  const folder = async (id) => {
    console.log('>>>>id',id)
    let predata = await prepare(id)

    if (!predata.credentials) return predata

    let { path, credentials } = predata

    let r = cache.get(id)
    if (r) {
      if (
        r.$cached_at &&
        r.children &&
        (Date.now() - r.$cached_at < onedrive_max_age_dir)

      ) {
        console.log(Date.now()+' CACHE OneDriveCNAPI '+ id)
        return r
      }
    }

    let api = `https://${credentials.tenant}-my.sharepoint.cn/_api/v2.0` + ((!path || path == '/') ? `/me/drive/root/` : `/me/drive/items/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`) + 'children'
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
    console.log(resp.body)
    if (!resp.body) return false
    if(resp.body.error) return { 
      protocol: defaultProtocol,
      type:'folder',
      body:'<p style="padding:24px;font-size:12px;">'+resp.body.error.message+'</p>'
    }
    const ts = Date.now()
    let children = resp.body.value.map((i) => {
      return {
        id: createId(credentials.client_id , (path+'/'+i.name).replace(/\/{2,}/g,'/')),
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

    let result = { id, path, type: 'folder', protocol: defaultProtocol }
    result.$cached_at = Date.now()
    result.children = children
    cache.set(id, result)
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

    // console.log()
    // let api = `https://${credentials.tenant}-my.sharepoint.cn/_api/v2.0/me/drive/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`
    
    let api = `https://${credentials.tenant}-my.sharepoint.cn/_api/v2.0/me/drive/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`
    let resp = await request.get(api , {headers:{
      'Authorization':`Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json'
    },json:true})
    if(resp.body){
      if( resp.body.error ){
        return {
          error:true,
          protocol: defaultProtocol,
          body:'<p style="padding:24px;font-size:12px;">'+resp.body.error.message+'</p>'
        }
      }
      data = {
        id: id,
        fid:resp.body.id,
        name: resp.body.name,
        protocol: defaultProtocol,
        size: resp.body.size,
        created_at: resp.body.createdDateTime,
        updated_at: resp.body.lastModifiedDateTime,
        ext: extname(resp.body.name),
        url:resp.body['@content.downloadUrl'],
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
      let api = `https://${credentials.tenant}-my.sharepoint.cn/_api/v2.0` + npath
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
        console.log('mkdir error')
      }
    }

    return true

  }


  const request_fix = (...rest) => {
    let req = request(...rest,function(error, response, body){
      // console.log('chunk from',offset)
      if(!error) {
        this.emit('finish' , body)
      }else{
        console.log('e',error)
      }
    })
    
    return req
  }

  const createChunkStream = ( url , size , offset = 0, chunkSize, retry = 3) => {
    let currentChunkSize = ( size - offset < chunkSize ) ? (size - offset) : chunkSize
    //console.log('create' , currentChunkSize,`bytes ${offset}-${offset+currentChunkSize-1}/${size}`)
    let req = request({
      url:url, 
      method:'put' , 
      headers:{
        'Content-Length':currentChunkSize,
        'Content-Range':`bytes ${offset}-${offset+currentChunkSize-1}/${size}`,
        'Content-Type': 'application/json'
      },
      json:true
    },function(error, response, body){
      // console.log('chunk from',offset)
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
          console.log('finish' , resp)
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

  const upload = async (path , size , credentials) => {
    let p = path.split('/')

    let name = decodeURIComponent( p.pop() )

    let api = `https://${credentials.tenant}-my.sharepoint.cn/_api/v2.0` + ((!path || path == '/') ? `/me/drive/root/` : `/me/drive/items/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`) + 'createUploadSession'
   // api = 'https://graph.microsoft.com/v1.0/me/drive/items/root:/Amlogic USB Burning Tool_v2.1.6.8.zip:/createUploadSession'

    console.log('createUploadSession', api)
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
      resp = e.body || e
    }
    
    if( resp.error ){
      console.log('error',resp.error)
      return { error : resp.error }
    }

    if(resp.body && resp.body.uploadUrl){
      console.log('Start Upload : '+resp.body.uploadUrl)
      // chunkSize = 327680 10485760
      return createRangeStream({url : resp.body.uploadUrl , chunkSize:10485760 , size})
    }
  }

  // <= 4194304
  const uploadFast = async (path , size , credentials) => {

    let api = `https://${credentials.tenant}-my.sharepoint.cn/_api/v2.0` + ((!path || path == '/') ? `/me/drive/root/` : `/me/drive/items/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`) + 'content'

    //{"error":{"code":"invalidRequest","message":"The size of the provided stream is not known. Make sure the request is not chunked, and the Content-Length header is specified"}}

    let req = request_fix({
      url:api , 
      method:'put',
      headers:{
        'Content-Length':size, 
        'Authorization':`Bearer ${credentials.access_token}`,
      }
    })

    return req
  }

  const createReadStream = async ({id , options = {}} = {}) => {
    let predata = await prepare(id)

    if (!predata.credentials) return predata

    let { path, credentials } = predata

    let api = `https://${credentials.tenant}-my.sharepoint.cn/_api/v2.0/me/drive/root:${encodeURIComponent(path).replace(/\/+$/g,'/')}:/`

    let resp = await request.get(api , {headers:{
      'Authorization':`bearer ${credentials.access_token}`,
      'Content-Type': 'application/json'
    },json:true})
    if(resp.body){
      let downloadUrl = resp.body['@content.downloadUrl']
      return request({url:downloadUrl , method:'get'})
    }
  }

  // id 当前有效路径
  // target 后续实际路径
  const createWriteStream = async ({ id , size , name, target = ''} = {}) => {
    let predata = await prepare(id)

    if (!predata.credentials) return null

    let { path, credentials } = predata

    //为path 创建目的地目录
    await mkdir(path , target , credentials)

    let paths = [filepath,target]
    if( type == 'folder' ){
      paths.push(name)
    }

    let fullpath = pathNormalize(paths.join('/'))


    if( size !== undefined ){
      console.log('clear',id)
      cache.clear(id)


      if( size <= 4194304 ){
        return await uploadFast(fullpath , size , credentials)
      }else{
        return await upload(fullpath , size , credentials)
      }
    }

  }

  return { name, label:'OD 世纪互联', version, drive: { protocols, folder, file , createReadStream , createWriteStream } }
}