/**
 * baidu netdisk
 */

const { URL } = require('url')

const urlFormat = require('url').format

const protocol = 'baidu'

const querystring = require('querystring')

const APP_KEY = ''

const SECRET_KEY = ''

const ERR_CODE = {
  '0':'请求成功',
  '2':'参数错误',
  '-6':'身份验证失败, access_token 是否有效? 部分接口需要申请对应的网盘权限',
  '-7':'文件或目录无权访问',
  '-9':'文件或目录不存在',
  '31034':'命中接口频控',
  '42000':'访问过于频繁',
  '42211':'图片详细信息查询失败',
  '42212':'共享目录文件上传者信息查询失败',
  '42213':'共享目录鉴权失败',
  '42214':'文件基础信息查询失败',
}

const API = 'https://pan.baidu.com/rest/2.0/xpan'

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

  getAuthority(){
    return 'http://openapi.baidu.com'
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


  async generateAuthUrl(config) {
    let { client_id, client_secret, redirect_uri } = config

    const opts = {
      client_id:client_id.split('.')[0],
      scope: 'basic,netdisk',
      response_type: 'code',
      redirect_uri: this.PROXY_URL,
      state: redirect_uri
    };

    this.pathAppMap[redirect_uri] = { client_id, client_secret, redirect_uri: opts.redirect_uri, create_time: Date.now() }

    return `${this.getAuthority()}/oauth/2.0/authorize?${querystring.stringify(opts)}`
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

    let { client_id, client_secret, redirect_uri } = appConfig
    
    let params = {
      client_id:client_id.split('.')[0],
      client_secret,
      code,
      redirect_uri,
      grant_type: 'authorization_code'
    }

    let resp
    try {
      resp = await this.helper.request.post(`${this.getAuthority()}/oauth/2.0/token`, params, { json: true })
    } catch (e) {
      resp = { error : e.toString() }
    }
    console.log(resp.body)

    if (resp.error) return resp
    if (resp.body.error) {
      return { error: resp.body.error_description || resp.body.error }
    }

    let { refresh_token, expires_in, access_token } = resp.body

    let client = {
      client_id,
      client_secret,
      redirect_uri,
      refresh_token,
      access_token,
      expires_at: Date.now() + expires_in * 1000,
    }

    this.clientMap[client_id] = client

    if (key) delete this.pathAppMap[key]

    await this.updateDrives(this.stringify(client))

    return client

  }

  async refreshAccessToken(credentials) {
    let { client_id, client_secret, redirect_uri, refresh_token } = credentials

    let metadata = this.getAuthority()

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
        resp = await this.helper.request.post(`${metadata}/oauth/2.0/token`, params, { json: true })
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
      // console.log('refreshAccessToken',resp.body)
      let { expires_in, access_token } = resp.body
      refresh_token = resp.body.refresh_token
      let expires_at = expires_in * 1000 + Date.now()
      let client = {
        client_id,
        client_secret,
        redirect_uri,
        refresh_token,
        access_token,
        expires_at,
      }

      this.clientMap[client_id] = client

      await this.updateDrives(this.stringify(client))

      return { credentials:client }
    }

    return { error: 'refreshAccessToken 失败，缺少参数' }
  }



  install(error) {
    let disabled = !APP_KEY || !SECRET_KEY
    return { id:'onedrive-install', type: 'folder', protocol, body: `
        <script data-no-instant src="https://cdn.bootcdn.net/ajax/libs/jquery/3.5.1/jquery.min.js"></script>

        <style>
        .auth{
          width: 80%;
          margin: 10% auto;
          max-width: 400px;
        }
        .auth h3{ text-align:center;}
        .auth p,.auth a{
          font-size:12px;
        }
        .auth a{
          color:#337ab7;
        }
        .custom{
          display:none;
        }
        .disabled{
          border-color: rgba(118, 118, 118, 0.3);
          background-color: initial;
          cursor: not-allowed;
          pointer-events:none;
        }
        </style>
        <div class="auth">
          <h3>百度网盘 挂载向导</h3>
          <div>
            <form class="form-horizontal" method="post">
              <input type="hidden" name="act" value="install" />
              <div class="form-item" style="font-size:12px;"><label class="flex"><input ${disabled?'disabled':''} checked="true" name="custom" id="j_custom" type="checkbox"> 使用自己的应用ID 和 应用机密</label>，请遵循 <a href="https://pan.baidu.com/union/document/protocol" target="_blank">使用协议</a>。</div>
              <div class="">
                  <p>1. 前往 <a target="_blank" style="margin-right:5px;cursor:pointer;" href="https://pan.baidu.com/union/console/createapp">Baidu网盘开发平台</a> 注册应用获取 API KEY" 和 SECRET KEY，注册类别 请选择为【软件】。<br />2. 前往 <a target="_blank" style="margin-right:5px;cursor:pointer;" href="http://developer.baidu.com/console#app/project">开发者服务管理</a> 设置网盘应用的授权回调页为: </p>
                  <p><a target="_blank" href="https://github.com/reruin/reruin.github.io/blob/master/sharelist/redirect.html" style="font-size:12px;margin-right:5px;color:#337ab7;">https://reruin.github.io/sharelist/redirect.html</a></p>
                  <div class="form-group"><input class="sl-input" type="text" name="client_id" value="" placeholder="API KEY" /></div>
                  <div class="form-group"><input class="sl-input" type="text" name="client_secret" value="" placeholder="SECRET KEY" /></div>
              </div>

              <button class="sl-button btn-primary" id="signin" type="submit">授权</button>
            </form>
          </div>
        </div>
        <script>
        function toggleCustom(){
          var checked = $('#j_custom').prop("checked")
          if( checked ){
            $('.custom').show()
          }else{
            $('.custom').hide()
          }
        }
        $(function(){
          $('#j_custom').on('change' , function(){
            toggleCustom()
          })
        })
        </script>
    `}
  }

  error(data,mount = true) {
    return { id:'baidu-unmounted', type: 'folder', protocol, body: `
      <div class="auth">
        ${ mount ? '<h3>百度网盘 挂载向导</h3>' : '' }
        <p style="font-size:12px;">${data}<br /></p>
        ${ mount ? '<p><a style="font-size:12px;cursor:pointer;" onclick="location.href=location.pathname">点击重新开始</a></p>' : '' }
      </div>
    `}
  }

  redirect(redirect) {
    return {
      id:'baidu-redirect',
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
        let { client_id , client_secret , custom } = req.body
        let body
        if( client_id && client_secret ) custom = true
        if(custom){
          if( !client_id || !client_secret ){
            data = this.error('Invalid APP_EKY / SECRET_KEY')
          }
        }else{
          if( APP_KEY ){
            client_id = APP_KEY + '.proxy.' + Date.now()
            client_secret = SECRET_KEY
          }else{
            data = this.error('Invalid APP_EKY / SECRET_KEY')
          }
        }
 
        if (!data && client_id && client_secret) {
          data = this.redirect(await this.generateAuthUrl({ client_id, client_secret, redirect_uri: baseUrl }))
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
    this.name = 'BaiduAPI'
    this.label = 'Baidu Netdisk'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 10 * 60 * 1000
    this.max_age_cookie = 5 * 24 * 60 * 60 * 1000 // 5 days

    this.manager = Manager.getInstance(helper)

    this.helper = helper

  }

  async ls(dir , access_token){
    let resp = await helper.request.get(API+'/file', {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'pan.baidu.com'
      },
      qs: {
        method:'list',
        access_token,
        dir: dir == '/' ? '/' : decodeURIComponent(dir.replace(/\/$/,'')),
        limit:10000,
        web:'web'
      },
      json: true
    })
   
    if (!resp.body) return false

    if (resp.body.errno) return manager.error(`[${resp.body.errno}]${ERR_CODE[resp.body.errno]}`,false)

    const ts = Date.now()
    return resp.body.list.map((i) => {
      return {
        id: manager.stringify({
          client_id,
          path: i.path + (i.isdir ? '/' : '')
        }),
        fid: i.fs_id,
        name: i.server_filename,
        ext: helper.extname(i.server_filename),
        protocol,
        size: i.size,
        created_at: helper.datetime(i.server_ctime),
        updated_at: helper.datetime(i.server_mtime),
        type: i.isdir ? 'folder' : 'other',
        $cached_at: ts
      }
    })
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

    let { client_id, access_token, path } = data

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

    //docs: https://pan.baidu.com/union/document/basic
    if (folder) {
      let resp = await helper.request.get(API+'/file', {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'pan.baidu.com'
        },
        qs: {
          method:'list',
          access_token,
          dir: path == '/' ? '/' : decodeURIComponent(path.replace(/\/$/,'')),
          limit:10000,
          web:'web'
        },
        json: true
      })
     
      if (!resp.body) return false

      if (resp.body.errno) return manager.error(`[${resp.body.errno}]${ERR_CODE[resp.body.errno]}`,false)

      const ts = Date.now()
      let children = resp.body.list.map((i) => {
        return {
          id: manager.stringify({
            client_id,
            path: i.path + (i.isdir ? '/' : '')
          }),
          fid: i.fs_id,
          name: i.server_filename,
          ext: helper.extname(i.server_filename),
          protocol,
          size: i.size,
          created_at: helper.datetime(i.server_ctime),
          updated_at: helper.datetime(i.server_mtime),
          type: i.isdir ? 'folder' : 'other',
          thumb:i.thumbs ? i.thumbs.url2 : '',
          $cached_at: ts
        }
      })

      let result = { id, path, type: 'folder', protocol: protocol }
      result.$cached_at = Date.now()
      result.children = children
      helper.cache.set(id, result)
      return result
    } 
    // file
    else {
      let parentId = manager.stringify({ client_id, path: path.split('/').slice(0, -1).join('/') + '/' })

      let parentData = await this.path(parentId)
      let hit = parentData.children.find(i => i.id == decodeURIComponent(id))
      if (!hit) return false

      let resp = await helper.request.get(API+'/multimedia', {
         headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'pan.baidu.com'
        },
        qs: {
          method:'filemetas',
          access_token,
          fsids: `[${hit.fid}]`,
          dlink:1,
        },
        json: true
      })

    // http://pan.baidu.com/rest/2.0/xpan/multimedia?access_token=123.456&method=filemetas&fsids=%5B414244021542671,633507813519281%5D&thumb=1&dlink=1&extra=1

      if (!resp.body) return false

      if (resp.body.errno) return manager.error(`[${resp.body.errno}]${resp.body.errmsg} ${ERR_CODE[resp.body.errno]}`,false)

      let file = resp.body.list[0]

      let result = {
        id: id,
        fid: hit.fid,
        name: hit.name,
        size: hit.size,
        created_at: hit.created_at,
        updated_at: hit.updated_at,
        ext: hit.ext,
        type: 'other',
        thumb:hit.thumb,
        protocol,
      }

      // 8 小时有效
      let dlink = file.dlink

      let redir = await helper.request({
        async:true,
        url:file.dlink + '&access_token=' + access_token,
        method:'GET',
        followRedirect:false ,
        headers:{
          'User-Agent':'pan.baidu.com',
        }
      })

      result.headers = {
        'Referrer-Policy':'no-referrer',
      }
      result.url = redir.headers.location

      console.log(hit.size)
      // 50M 以上，直接下载包 sign error, 使用中转
      if( hit.size > 50 * 1024 * 1024 ){
        result.headers = {
          'User-Agent':'pan.baidu.com',
          'Referer':'https://pan.baidu.com'
        }
        result.proxy = true
      }
      
      if( result.url ){
        result.$expired_at = Date.now() + 7.5 * 3600 * 1000
        return result
      }else{
        return false
      }

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