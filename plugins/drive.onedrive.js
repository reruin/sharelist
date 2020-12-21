/**
 * onedrive
 */

const { URL } = require('url')

const urlFormat = require('url').format

const protocol = 'onedrive'

const crypto = require('crypto')

const querystring = require('querystring')

const support_zone = {
  'GLOBAL': [
    'https://login.microsoftonline.com',
    'https://graph.microsoft.com',
    'https://portal.azure.com',
    '全球',
    ['00cdbfd5-15a5-422f-a7d7-75e8eddd8fa8','pTvE-.ooe8ou5p1552O8s.3WK996UZ.Z8M']
  ],
  'CN': [
    'https://login.chinacloudapi.cn',
    'https://microsoftgraph.chinacloudapi.cn',
    'https://portal.azure.cn',
    '世纪互联',
  ],
  'DE': [
    'https://login.microsoftonline.de',
    'https://graph.microsoft.de',
    'https://portal.microsoftazure.de',
    'Azure 德国'
  ],
  // L4
  'USGOV': [
    'https://login.microsoftonline.us',
    'https://graph.microsoft.us',
    'https://portal.azure.us',
    'Azure US GOV',
  ]
}


/**
 * auth manager class
 */
class Manager {
  static getInstance(helper) {
    if (!this.instance) {
      this.instance = new Manager(helper)
      this.instance.init()
    }
    return this.instance
  }

  constructor(helper) {
    this.clientMap = {}
    this.pathAppMap = {}
    this.helper = helper

    this.PROXY_URL = 'https://reruin.github.io/sharelist/redirect.html'
  }

  /**
   * Update config
   *
   * @param {string} [client]
   * @api private
   */
  async updateDrives(client) {
    const { helper } = this

    let paths = await helper.getDrives()
    let data = paths.map(i => this.parse(i.path, i.name))
    let name = decodeURIComponent(helper.getRuntime().path.replace(/^\//g, ''))
    let hit = data.filter(i => i.name == name)

    //路径也无法匹配
    if (hit.length == 0) {
      //仅有一个可用挂载源
      if (data.length == 1 && paths.length == 1 && paths[0].root) {
        hit = data
      }
    }

    hit.forEach(i => {
      helper.saveDrive(client, i.name)
    })
  }

  async init() {
    let d = await this.helper.getDrives()
    for (let i of d) {
      let data = this.parse(i.path)
      if(data.client_id && !data.share){
        data.graph = this.getGraphEndpoint(data.zone,data.tenant_id)
      }
      this.clientMap[data.client_id] = data
    }
  }

  /**
   * Get credentials by id
   *
   * @param {string} [id]
   * @return {object}
   * @api public
   */
  async get(id) {
    let data = this.parse(id)
    if (data.client_id && this.clientMap[data.client_id]) {
      let credentials = this.clientMap[data.client_id]
      let { update_time, expires_in } = credentials

      if ((Date.now() - update_time) > expires_in * 1000 * 0.9) {
        let result = await this.refreshAccessToken(credentials)
        if (result.error) {
          return result
        } else {
          credentials = this.clientMap[data.client_id]
        }
      }

      credentials.path = data.path ? data.path : '/'

      return { credentials }
    }

    return { unmounted: true }
  }

  /**
   * Parse path
   *
   * @param {string} [path]
   * @param {string} [name]
   * @return {object}
   * @api private
   */
  parse(path, name) {
    let data = new URL(path)
    let client_id = data.hostname
    let query = {}

    for (const [key, value] of data.searchParams) {
      query[key] = value
    }

    let result = {
      client_id,
      path: data.pathname || '/',
      ...query
    }
    if( name ) result.name = name
    return result
  }


  /**
   * Create id
   * 
   * azure://<client_id>/<path>
   * azure://<client_id>/<path>?client_secret=<client_secret>&zone=<zone>&tenant_id=<tenant_id>
   *
   * @param {object}
   * @param {string} [agrs]
   * @param {string} [agrs.client_id]
   * @param {string} [agrs.client_secret]
   * @param {string} [agrs.zone]
   * @param {string} [agrs.tenant_id]
   * @return {string}
   * @api public
   */
  stringify({ client_id, path, ...query }) {
    return urlFormat({
      protocol: protocol,
      slashes: true,
      hostname: client_id,
      pathname: (path == '') ? '/' : path,
      query,
    })
  }

  getScopes(zone) {
    let zoneScope = support_zone[zone || 'GLOBAL'][1]
    return [
      'offline_access', 
      //`${zoneScope}/Files.ReadWrite.All`,
      'files.readwrite.all'
    ].join(' ')
  }

  getAuthority(zone , tenant_id){
    return support_zone[zone || 'COMMON'][0] + '/' + (tenant_id || 'common')
  }

  getDefaultConfig(zone){
    return support_zone[zone || 'COMMON'][4]
  }

  getGraphEndpoint(zone , site_id){
    site_id = false
    //sites/' . getConfig('siteid') . '
    return support_zone[zone || 'COMMON'][1] + '/v1.0' + (site_id ? `/sites/${site_id}` : '/me') + '/drive'
  }

  async generateAuthUrl(config) {
    let { client_id, client_secret, zone, tenant_id, redirect_uri } = config
    let metadata = this.getAuthority(zone, tenant_id)

    const opts = {
      client_id,
      scope: this.getScopes(zone),
      response_type: 'code',
      redirect_uri: this.PROXY_URL,
      state: redirect_uri
    };

    this.pathAppMap[redirect_uri] = { client_id, client_secret, zone, tenant_id, metadata, redirect_uri: opts.redirect_uri, create_time: Date.now() }

    return `${metadata}/oauth2/v2.0/authorize?${querystring.stringify(opts)}`;
  }

  /**
   * 验证code 并获取 credentials
   *
   * @param {string} 标识
   * @param {string} code
   * @api private
   */
  async getAccessToken(code, key) {
    let appConfig = this.pathAppMap[key]
    if (!appConfig) return {
      error: '没有匹配到app_id(key:' + key + ')'
    }

    let { client_id, client_secret, metadata, zone, tenant_id, redirect_uri } = appConfig

    let params = {
      client_id,
      client_secret,
      code,
      redirect_uri,
      grant_type: 'authorization_code'
    }

    let resp
    try {
      resp = await this.helper.request.post(`${metadata}/oauth2/v2.0/token`, params, { json: true })
    } catch (e) {
      resp = { error : e.toString() }
    }
      
    if (resp.error) return resp

    if (resp.body.error) {
      return { error: resp.body.error_description || resp.body.error }
    }

    let { refresh_token, expires_in, access_token } = resp.body

    let client = {
      client_id,
      client_secret,
      zone,
      tenant_id,
      redirect_uri,
      refresh_token,
      expires_in,
      access_token,
      update_time: Date.now(),
    }

    this.clientMap[client_id] = {
      ...client,
      metadata: this.getAuthority(zone,tenant_id),
      graph: this.getGraphEndpoint(zone,tenant_id)
    }

    if (key) delete this.pathAppMap[key]

    await this.updateDrives(this.stringify(client))

    return client

  }

  /**
   * 获取分享链接的 credentials
   * access token 有效期 5 * 60 * 60 s
   *
   * @param {string} url
   * @param {object} 
   * @api private
   */
  async getShareAccessToken(url){
    let { request , base64 } = this.helper
    let [ _, tenant_name, account ] = url.match(/https:\/\/([^\.]+).sharepoint\.com\/:[a-z]:\/g\/personal\/([^\/]+)\//)
    let origin = `https://${tenant_name}.sharepoint.com`

    let { body , headers , error } = await request.get(url , { followRedirect:false, headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36'}})
    
    let cookie = headers['set-cookie'] ? headers['set-cookie'].join('; ') : ''

    let qs = {
      'a1':`'/personal/${account}/Documents'`,
      RootFolder:`/personal/${account}/Documents/`,
      TryNewExperienceSingle:'TRUE',
    }

    let data = {"parameters":{"__metadata":{"type":"SP.RenderListDataParameters"},"RenderOptions":136967,"AllowMultipleValueFilterForTaxonomyFields":true,"AddRequiredFields":true}}
    let newurl = `${origin}/personal/${account}/_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream?@${querystring.stringify(qs)}`

    try{
      ({body , headers , error} = await request({
        url:newurl,
        method: 'POST',
        body:data,
        headers:{ 
          origin,cookie,
          accept:'application/json;odata=verbose',
          'Content-Type' :'application/json;odata=verbose',
        },
        async:true,
        json:true
      }));
    }catch(e){
      console.log(e)
    }

    if( error ){
      return { error: error.toString() }
    }
    if(body && body.error){
      return { error: body.error.code }
    }

    let access_token = body['ListSchema']['.driveAccessToken'].split('=')[1]
    let graph = body['ListSchema']['.driveUrl']
    let update_time = Date.now()
    let expires_in = parseInt(JSON.parse(base64.decode(access_token.split('.')[1]))['exp']) - Math.floor(update_time / 1000)
    let client_id = base64.encode(encodeURIComponent(url))

    let client = {
      access_token,
      client_id,
      expires_in,
      update_time,
      graph,
      share:1
    }

    await this.updateDrives(this.stringify(client))

    this.clientMap[client_id] = {
      ...client
    }

    return { credentials:client }

    //console.log(body , headers)
  }

  async refreshAccessToken(credentials) {
    let { client_id, client_secret, redirect_uri, refresh_token, zone, tenant_id , share } = credentials
    if( share ){
      return this.getShareAccessToken( decodeURIComponent(this.helper.base64.decode(client_id) ))
    }
    let metadata = this.getAuthority(zone,tenant_id)
    if (client_id && client_secret && refresh_token) {

      let params = {
        client_id,
        client_secret,
        redirect_uri,
        refresh_token,
        grant_type: 'refresh_token'
      }

      let resp
      try {
        resp = await this.helper.request.post(`${metadata}/oauth2/v2.0/token`, params, { json: true })
      } catch (e) {
        let msg = 'unknow error'
        if(e.body && e.body.error_description){
          msg = e.body.error_description
        }
        resp = { error : msg }
      }

      if (resp.error) return resp

      if (resp.body.error) {
        return { error: resp.body.error_description || resp.body.error }
      }

      let { expires_in, access_token } = resp.body
      refresh_token = resp.body.refresh_token

      let client = {
        client_id,
        client_secret,
        zone,
        tenant_id,
        redirect_uri,
        refresh_token,
        expires_in,
        access_token,
        update_time: Date.now(),
      }

      this.clientMap[client_id] = {
        ...client,
        metadata: this.getAuthority(zone,tenant_id),
        graph: this.getGraphEndpoint(zone,tenant_id)
      }

      await this.updateDrives(this.stringify(client))

      console.log('refresh_token')
      return { credentials:client }
    }

    return { error: 'refreshAccessToken 失败，缺少参数' }
  }



  install(error) {
    let zone = []
    for (let [key, value] of Object.entries(support_zone)) {
      zone.push(`<option value="${key}" data-portal="${value[2]}" ${key == 'GLOBAL' ? 'selected' : ''}>${value[3]}</option>`)
    }
    return { id:'onedrive-install', type: 'folder', protocol, body: `
      <script src="https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js"></script>
      <style>
        .auth{
          width: 80%;
          margin: 10% auto;
          max-width: 560px;
        }
        .l-center{
          margin:auto;
          text-align:center;
        }
        h3{
          font-size:16px;
          text-align:center;
        }
        .auth p,.auth a{
          font-size:12px;
        }
        .auth a{
          color:#337ab7;
        }
        
        .form-item{
          margin-bottom:8px;
          display:none;
        }
        .form-item.show{
          display:block;
        }
      </style>
      <div class="auth">
        <h3>OneDrive 挂载向导</h3>
        
        <form class="form-horizontal" method="post">
          <div class="l-center" style="font-size:13px;">
            <label><input type="radio" name="type" value="api" checked /> API 挂载</label>
            <label><input type="radio" name="type" value="sharelink" /> 分享链接挂载</label>
            <label><input type="radio" name="type" value="auto" /> 自动挂载</label>
          </div>
          <input type="hidden" name="act" value="install" />

          <div class="form-body">
            <div class="form-item tab-api tab-auto">
              <select id="j_zone" name="zone">
                ${zone.join('')}
              </select>
              <div></div>
            </div>
            <div class="form-item tab-api">
              <p>前往 <a style="margin-right:5px;" id="j_portal">Azure管理后台</a> 注册应用获取 应用ID 和 应用机密。</p>
              <p>重定向 URI 请设置为 <a target="_blank" href="https://github.com/reruin/reruin.github.io/blob/master/sharelist/redirect.html" style="font-size:12px;margin-right:5px;color:#337ab7;">https://reruin.github.io/sharelist/redirect.html</a></p>
            </div>
            <div class="form-item tab-api"><input class="sl-input" type="text" name="client_secret" value="" placeholder="应用机密 / app_secret" /></div>
            <div class="form-item tab-api"><input class="sl-input" type="text" name="client_id" value="" placeholder="应用ID / app_id" /></div>
            <div class="form-item tab-api"><input class="sl-input" type="text" name="tenant_id" value="" placeholder="租户ID / tenant_id (企业版/教育版 子账户必填)" /></div>

            <div class="form-item tab-sharelink"><input class="sl-input" type="text" name="share_url" value="" placeholder="URL https://xxxx.sharepoint.com/:f:/g/personal/xxxxxxxx/mmmmmmmmm?e=XXXX" /></div>

            <div class="form-item tab-auto">
              <p style="margin:16px 0;">ShareList将使用内置的 app_id 和 app_secret 进行挂载。</p>
            </div>
          </div>
          <button class="sl-button btn-primary" id="signin" type="submit">验证</button>
        </form>
        
      </div>
      <script>
        function toggleType(type){
          // $('.form-item.tab-'+type).fadeIn().siblings('.form-item').fadeOut() 
          $('.form-item').hide()
          $('.form-item.tab-'+type).fadeIn(150)
        }

        $(function(){
          $('input:radio[name=type]').on('change', function() {
            toggleType(this.value)
          });

          $('#j_portal').on('click' , function(){
            var option = $("#j_zone option:selected")
            var portal = option.attr('data-portal') + '/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade';

            window.open(portal)
          })

          toggleType($('input:radio[name=type]:checked').val())
        })


      </script>
    `}
  }

  error(data,mount = true) {
    return { id:'onedrive-unmounted', type: 'folder', protocol, body: `
      <div class="auth">
        ${ mount ? '<h3>OneDrive 挂载向导</h3>' : '' }
        <p style="font-size:12px;">${data}<br /></p>
        ${ mount ? '<p><a style="font-size:12px;cursor:pointer;" onclick="location.href=location.pathname">点击重新开始</a></p>' : '' }
      </div>
    `}
  }

  redirect(redirect) {
    return {
      id:'onedrive-redirect',
      type: 'folder',
      protocol: protocol,
      redirect
    }
  }

  async update(id) {
    let data = this.parse(id)
    if (data.username) {
      let hit = this.clientMap[data.username]
      if (hit) {
        return await this.create(hit.username, hit.password)
      }
    }
  }

  /**
   * Get auth from id
   *
   * @param {string} [id]
   * @return {object}
   * @api public
   */
  async prepare(id) {

    if (!id.startsWith(protocol)) {
      id = protocol + ':' + id
    }

    const req = this.helper.getRuntime('req')

    let baseUrl = req.origin + req.path

    let { credentials, error, unmounted } = await this.get(id)
    if (unmounted){
      let data

      if (req.body && req.body.act && req.body.act == 'install') {
        let { client_id, client_secret, zone, tenant_id = 'common', share_url , type } = req.body
        let body
        if (type == 'sharelink'){
          let credentials = await this.getShareAccessToken(share_url)
          if (credentials.error) {
            data = this.error(credentials.error)
          } else {
            data = this.redirect(baseUrl)
          }
        }else{
          if( !zone ){
            data = this.error('请选择地域')
          }
          if(type == 'auto'){
            [client_id,client_secret] = this.getDefaultConfig(zone)
            if( !client_id ){
              data = this.error('暂不支持当前地域')
            } 
          }

          if (client_id && client_secret && zone) {
            data = this.redirect(await this.generateAuthUrl({ client_id, client_secret, redirect_uri: baseUrl, zone, tenant_id }))
          } 
        }
      }
      // 挂载验证回调
      else if (req.query.code) {
        let credentials = await this.getAccessToken(req.query.code, baseUrl)
        if (credentials.error) {
          data = this.error(credentials.error)
        } else {
          data = this.redirect(baseUrl)
        }
      } 

      else if(req.query.error){
        data = this.error(req.query.error_description || req.query.error)
      }

      else{
        data = this.install()
      }

      return { ready:false, data }
    }

    else{
      if( error ){
        return { ready:false, data:this.error(error) }
      }else{
        return { ready:true, data:credentials }
      }
    }
  }

  async request({ url }){

  }
}


/**
 * 
 * 
 */
class Driver {
  constructor(helper) {
    this.name = 'OneDriveAPI-V2'
    this.label = 'OneDrive V2'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 10 * 60 * 1000
    this.max_age_cookie = 5 * 24 * 60 * 60 * 1000 // 5 days

    this.manager = Manager.getInstance(helper)

    this.helper = helper

  }


  /**
   * Get data by path
   *
   * @param {string} [id] path id
   * @return {object}
   * @api private
   */
  async path(id) {
    let { manager, protocol, helper, max_age_dir } = this

    let { ready , data } = await manager.prepare(id)

    if (!ready) return data

    let { graph, client_id, access_token, path } = data

    id =  manager.stringify({client_id,path})

    let r = helper.cache.get(id)
    // console.log(id , path,graph )
    if (r) {
      if (
        (
          r.$expired_at && Date.now() < r.$expired_at
        ) ||
        (
          r.$cached_at &&
          r.children &&
          (Date.now() - r.$cached_at < max_age_dir)
        )
      ) {
        console.log(Date.now() + ' CACHE Azure ' + id)
        return r
      }
    }

    let folder = path.endsWith('/')
    //docs: https://docs.microsoft.com/zh-cn/graph/api/driveitem-list-children?view=graph-rest-1.0&tabs=http
    if (folder) {
      let url = graph + '/root' + (path == '/' ? '' : `:${path.replace(/\/+$/,'')}:`) + '/children'

      let resp = await helper.request.get(url, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        qs: {
          select: 'id,name,size,file,folder,@microsoft.graph.downloadUrl,thumbnails,createdDateTime,lastModifiedDateTime',
          top: 999999
        },
        json: true
      })

      if (!resp.body) return false

      if (resp.body.error) return manager.error(resp.body.error.message,false)

      const ts = Date.now()

      let children = resp.body.value.map((i) => {
        return {
          id: manager.stringify({
            client_id,
            path: (path + i.name + (i.folder ? '/' : ''))
          }),
          fid: i.id,
          name: i.name,
          ext: helper.extname(i.name),
          protocol,
          size: i.size,
          created_at: i.createdDateTime,
          updated_at: i.lastModifiedDateTime,
          url: i['@microsoft.graph.downloadUrl'] || i['@content.downloadUrl'],
          type: i.folder ? 'folder' : 'other',
          $cached_at: ts
        }
      })

      let result = { id, path, type: 'folder', protocol: protocol }
      result.$cached_at = Date.now()
      result.children = children
      helper.cache.set(id, result)
      return result
    } else {
      let url = `${graph}/root:${path}`
      let resp = await helper.request.get(url, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        json: true
      })

      if (!resp.body) return false

      if (resp.body.error) return manager.error(resp.body.error.message,false)

      let result = {
        id: id,
        fid: resp.body.id,
        name: resp.body.name,
        protocol,
        size: resp.body.size,
        created_at: resp.body.createdDateTime,
        updated_at: resp.body.lastModifiedDateTime,
        ext: helper.extname(resp.body.name),
        // different zone use different filed
        url: resp.body['@microsoft.graph.downloadUrl'] || resp.body['@content.downloadUrl'],
        type: resp.body.folder ? 'folder' : 'other',
      }
      if (!result.url && resp.body.webUrl) {
        result.type = 'redirect'
        result.redirect = resp.body.webUrl
      }
      return result
    }

    return false

  }

  /**
   * Folder handler
   *
   * @param {string} [id] path id
   * @return {object} 
   *
   * @api public
   */
  async folder(id) {
    return await this.path(id)
  }

  /**
   * File handler
   *
   * @param {string} [id] path id
   * @return {object} 
   *
   * @api public
   */
  async file(id) {
    return await this.path(id)
  }

  async mkdir(id, name) {
    

  }

  async createReadStream({ id, options = {} } = {}) {
    let resp = await this.file(id)
    if (resp.body) {
      return resp
    } else {
      let readstream = this.helper.request({ url: resp.url, method: 'get' })
      return this.helper.wrapReadableStream(readstream, { size: resp.size })
    }
  }

}


module.exports = Driver