/**
 * onedrive
 */

const { URL } = require('url')

const urlFormat = require('url').format

const protocol = 'onedrive'

const crypto = require('crypto')

const querystring = require('querystring')

const support_zone = {
  'COM': [
    'https://login.microsoftonline.com',
    'https://graph.microsoft.com',
    'https://portal.azure.com',
    '全球',
    'https://www.office.com/',
    ['00cdbfd5-15a5-422f-a7d7-75e8eddd8fa8','pTvE-.ooe8ou5p1552O8s.3WK996UZ.Z8M'],
  ],
  'CN': [
    'https://login.chinacloudapi.cn',
    'https://microsoftgraph.chinacloudapi.cn',
    'https://portal.azure.cn',
    '世纪互联',
    'https://portal.partner.microsoftonline.cn/Home',
    ['9430c343-440f-44f3-ba1d-18b77c0072af','8f3.2dD-_.6mLv-VmMo6vCxuYcm5~Liqn4'],
  ],
  'DE': [
    'https://login.microsoftonline.de',
    'https://graph.microsoft.de',
    'https://portal.microsoftazure.de',
    'Azure 德国'
  ],
  // L4
  'US': [
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
        data.graph = this.getGraphEndpoint(data.zone,data.site_id)
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
      let { expires_at } = credentials

      if ((expires_at - Date.now()) < 10 * 60 * 1000) {
        let result = await this.refreshAccessToken(credentials)
        if (result.error) {
          return result
        } else {
          credentials = this.clientMap[data.client_id]
        }
      }

      return { credentials:{...credentials , path:data.path ? data.path : '/'} }
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
    let zoneScope = support_zone[zone || 'COM'][1]
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
    return support_zone[zone || 'COMMON'][5] || []
  }

  getGraphEndpoint(zone , site_id = false){
    return support_zone[zone || 'COMMON'][1] + '/v1.0' + (site_id ? `/sites/${site_id}` : '/me') + '/drive'
  }

  getGraphEndpointSite(zone , site_name){
    //sites/' . getConfig('siteid') . '
    return support_zone[zone || 'COMMON'][1] + '/v1.0/sites/root:/' + site_name
  }

  async generateAuthUrl(config) {
    let { client_id, client_secret, zone, tenant_id, redirect_uri, site_name, path } = config

    const opts = {
      client_id:client_id.split('.')[0],
      scope: this.getScopes(zone),
      response_type: 'code',
      redirect_uri: this.PROXY_URL,
      state: redirect_uri
    };

    this.pathAppMap[redirect_uri] = { client_id, client_secret, zone, tenant_id, path, redirect_uri: opts.redirect_uri, create_time: Date.now(), site_name }

    return `${this.getAuthority(zone, tenant_id)}/oauth2/v2.0/authorize?${querystring.stringify(opts)}`;
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
      error: '没有匹配到app_id , No matching app_id (key:' + key + ')'
    }

    let { client_id, client_secret, zone, tenant_id, redirect_uri, site_name, path } = appConfig
    
    let metadata = this.getAuthority(zone,tenant_id)

    let params = {
      client_id:client_id.split('.')[0],
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
    let site_id
    // get sharepoint site id
    if( site_name ){
      let api = this.getGraphEndpointSite(zone , site_name)
      try{
        let resp = await this.helper.request.get(api, { json: true , headers:{
          'Authorization':'Bearer '+access_token
        } })
        site_id = resp.body.id
      }catch(e){
       return { error: 'parse site id error' }
      }
    }
    let client = {
      client_id,
      client_secret,
      zone,
      tenant_id,
      site_id,
      redirect_uri,
      refresh_token,
      access_token,
      path,
      expires_at: Date.now() + expires_in * 1000,
    }

    this.clientMap[client_id] = {
      ...client,
      graph: this.getGraphEndpoint(zone,site_id)
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
  async getShareAccessToken(url , path){
    let { request , base64 } = this.helper

    let { body , headers , error } = await request.get(url , { followRedirect:false, headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36'}})
    
    let cookie = headers['set-cookie'] ? headers['set-cookie'].join('; ') : ''

  
    let obj = new URL(headers['location'])
    let origin = obj.origin
    let rootFolder = obj.searchParams.get('id')
    let account = rootFolder.split(' ')[0].replace('/Shared','').replace(/Documents.*?$/,'')

    let qs = {
      a1:`'${rootFolder.replace(/(?<=Documents).*$/,'')}'`,
      RootFolder:rootFolder,
      TryNewExperienceSingle:'TRUE',
    }
    let data = {"parameters":{"__metadata":{"type":"SP.RenderListDataParameters"},"RenderOptions":1446151,"AllowMultipleValueFilterForTaxonomyFields":true,"AddRequiredFields":true}}
    let newurl = `${origin}${account}/_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream?@${querystring.stringify(qs)}`
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

    if(!body.ListSchema['.driveAccessToken']){
      return { error: '请将分享文件夹设置[拥有链接的任何人都可编辑] / The shared folder must be given editing permissions' }
    }
    let access_token = body['ListSchema']['.driveAccessToken'].split('=')[1]
    let graph = body['ListSchema']['.driveUrl']
    let expires_at = parseInt(JSON.parse(base64.decode(access_token.split('.')[1]))['exp']) * 1000
    let client_id = base64.encode(encodeURIComponent(url))

    let client = {
      access_token,
      client_id,
      expires_at,
      graph,
      path,
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
    let { client_id, client_secret, redirect_uri, refresh_token, zone, tenant_id, site_id, share, path } = credentials
    if( share ){
      return this.getShareAccessToken( decodeURIComponent(this.helper.base64.decode(client_id) ))
    }

    let metadata = this.getAuthority(zone,tenant_id)

    if (client_id && client_secret && refresh_token) {
      let params = {
        client_id:client_id.split('.')[0],
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
      let expires_at = expires_in * 1000 + Date.now()
      let client = {
        client_id,
        client_secret,
        zone,
        tenant_id,
        site_id,
        path,
        redirect_uri,
        refresh_token,
        access_token,
        expires_at
      }

      this.clientMap[client_id] = {
        ...client,
        graph: this.getGraphEndpoint(zone,site_id)
      }

      await this.updateDrives(this.stringify(client))

      return { credentials:client }
    }

    return { error: 'refreshAccessToken 失败，缺少参数' }
  }



  install(error) {
    let zone = [] , types = ['onedrive','sharepoint']

    for (let [key, value] of Object.entries(support_zone)) {
      zone.push(`<option value="${key}" data-sharepoint="${value[4] || ''}" data-portal="${value[2] || ''}" ${key == 'COM' ? 'selected' : ''}>${value[3]}</option>`)
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
        }
        .form-item.show{
          display:block;
        }

        .tab{
          display:none;
        }
      </style>
      <div class="auth">
        <h3>OneDrive 挂载向导</h3>
        
        <form class="form-horizontal" method="post">
          <div class="l-center" style="font-size:13px;">
            <label><input type="radio" name="type" value="onedrive" checked /> OneDrive 挂载</label>
            <label><input type="radio" name="type" value="sharepoint" /> SharePoint 挂载</label>
            <label><input type="radio" name="type" value="sharelink" /> SharePoint 分享链接挂载</label>
          </div>
          <input type="hidden" name="act" value="install" />

          <div class="form-body">
            <div class="form-item tab tab-onedrive tab-auto tab-sharepoint">
              <select id="j_zone" name="zone">
                ${zone.join('')}
              </select>
            </div>
            <div class="tab tab-sharepoint">
              <p>前往 <a style="margin-right:5px;cursor:pointer;" id="j_portal_office">office365</a>，点击应用 sharepoint，创建一个网站，将URL地址填入下方输入框中。</p>
              <input class="sl-input zone_change_placeholder" type="text" name="sharepoint_site" value="" placeholder="URL https://xxxxxx.sharepoint.com/sites(teams)/xxxxxx" />
            </div>
            <div class="tab tab-sharepoint tab-onedrive">
              <div class="form-item" style="font-size:12px;"><label><input name="custom" id="j_custom" type="checkbox"> 使用自己的应用ID 和 应用机密</label></div>
              <div class="tab-custom">
                <p>前往 <a style="margin-right:5px;cursor:pointer;" id="j_portal">Azure管理后台</a> 注册应用获取 应用ID 和 应用机密。重定向 URI 请设置为: </p>
                <p><a target="_blank" href="https://github.com/reruin/reruin.github.io/blob/master/sharelist/redirect.html" style="font-size:12px;margin-right:5px;color:#337ab7;">https://reruin.github.io/sharelist/redirect.html</a></p>
                <div class="form-item"><input class="sl-input" type="text" name="client_id" value="" placeholder="应用ID / app_id" /></div>
                <div class="form-item"><input class="sl-input" type="text" name="client_secret" value="" placeholder="应用机密 / app_secret" /></div>
                <div class="form-item"><input class="sl-input" type="text" name="tenant_id" value="" placeholder="租户ID / tenant_id (多租户可选)" /></div>

              </div>
            </div>
            

            <div class="form-item tab tab-sharelink"><input class="sl-input" type="text" name="share_url" value="" placeholder="URL https://xxxx.sharepoint.com/:f:/g/personal/xxxxxxxx/mmmmmmmmm?e=XXXX" /></div>
            
            <div class="form-item"><input class="sl-input" type="text" name="path" value="" placeholder="挂载目录 如 /abc/def，默认留空 挂载根目录" /></div>

          </div>
          <button class="sl-button btn-primary" id="signin" type="submit">验证</button>
        </form>
        
      </div>
      <script>
        function toggleType(type){
          // $('.tab.tab-'+type).fadeIn().siblings('.tab').fadeOut() 
          $('.tab').hide()
          $('.tab.tab-'+type).fadeIn(150)
          toggleCustom()

        }

        function toggleCustom(){
          var checked = $('#j_custom').prop("checked")
          if( checked ){
            $('.tab-custom').show()
          }else{
            $('.tab-custom').hide()
          }
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

          $('#j_portal_office').on('click' , function(){
            var option = $("#j_zone option:selected")
            var portal = option.attr('data-sharepoint');
            if( portal ){
              window.open(portal)
            }else{
              alert('暂不支持当前地域')
            }
          })

          $('#j_type').on('change' , function(){
            $('.form-item').hide()
            $('.form-item.tab-'+type).fadeIn(150)
          })

          $('#j_custom').on('change' , function(){
            toggleCustom()
          })

          $('#j_zone').on('change' , function(){
            let zone = $(this).val().toLowerCase()
            $('input.zone_change_placeholder').each(function(){
              var tip = $(this).attr('placeholder')
              $(this).attr('placeholder' , tip.replace(/sharepoint\.[a-z]+/,'sharepoint.'+zone))
            })
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

    let { base64 } = this.helper

    let baseUrl = req.origin + req.path

    let { credentials, error, unmounted } = await this.get(id)
    if (unmounted){
      let data

      if (req.body && req.body.act && req.body.act == 'install') {
        let { client_id, client_secret, zone, tenant_id = 'common', custom, share_url, sharepoint_site, type, path } = req.body
        let body , site_name
        if( path && !path.endsWith('/')) path += '/'
        if (type == 'sharelink'){
          let credentials = await this.getShareAccessToken(share_url,path)
          if (credentials.error) {
            data = this.error(credentials.error)
          } else {
            data = this.redirect(baseUrl)
          }
        }else{
          if(custom){
            if( !client_id || !client_secret ){
              data = this.error('require client_id and client_secret')
            }
          }else{
            [client_id,client_secret] = this.getDefaultConfig(zone)
            if( !client_id ){
              data = this.error('暂不支持当前地域')
            } else{
              client_id = client_id + '.proxy.' + Date.now()
            }
          }

          if(type == 'sharepoint'){
            if( sharepoint_site ){
              let obj = new URL(sharepoint_site)
              site_name = obj.pathname
            }else{
              data = this.error('请填写sharepoint站点URL<br/>require sharepoint site')
            }
          }

          if (!data && client_id && client_secret && zone) {
            data = this.redirect(await this.generateAuthUrl({ client_id, client_secret, redirect_uri: baseUrl, zone, tenant_id, site_name , path }))
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
          top: 999999,
          '$expand':'thumbnails'
        },
        json: true
      })

      if (!resp.body) return false
      if (resp.body.error) return manager.error(resp.body.error.message,false)

      const ts = Date.now()

      let children = resp.body.value.map((i) => {
        let thumb = i.thumbnails.length > 0 ? i.thumbnails[0].medium.url : ''

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
          thumb,
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
      let resp = await helper.request.get(url+'?$expand=thumbnails', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        json: true
      })
      if (!resp.body) return false

      if (resp.body.error) return manager.error(resp.body.error.message,false)
      let thumb = resp.body.thumbnails.length > 0 ? resp.body.thumbnails[0].medium.url : ''

      let result = {
        id: id,
        fid: resp.body.id,
        name: resp.body.name,
        protocol,
        size: resp.body.size,
        created_at: resp.body.createdDateTime,
        updated_at: resp.body.lastModifiedDateTime,
        ext: helper.extname(resp.body.name),
        url: resp.body['@microsoft.graph.downloadUrl'] || resp.body['@content.downloadUrl'],
        thumb,
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