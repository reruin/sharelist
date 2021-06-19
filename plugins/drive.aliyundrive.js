/**
 * Aliyun Drive
 *
 * aliyun://userId/driveId/folderId/?password
 * aliyun://userId/driveId/folderId/fileId?password
 */
const { URL } = require('url')

const urlFormat = require('url').format

const protocol = 'aliyun'

/**
 * auth manager class
 */
class Manager {
  static getInstance(app, helper) {
    if (!this.instance) {
      this.instance = new Manager(app, helper)
    }
    return this.instance
  }

  constructor(app, helper) {
    this.clientMap = {}
    this.helper = helper
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
    let name = decodeURIComponent(helper.getRuntime('req').path.replace(/^\//g, ''))
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


  init(d) {
    for (let i of d) {
      let data = this.parse(i.path)
      this.clientMap[data.user_id] = data
    }
  }

  /**
   * get options by id
   *
   * @param {string} [id]
   * @return {object}
   * @api public
   */
  async get(id) {
    let data = this.parse(id)
    if (data.user_id && this.clientMap[data.user_id]) {
      let credentials = this.clientMap[data.user_id]
      let { expires_at } = credentials

      if ((expires_at - Date.now()) < 60 * 1000) {
        let result = await this.refreshAccessToken(credentials)
        if (result.error) {
          return result
        } else {
          credentials = this.clientMap[data.user_id]
        }
      }
      return { credentials:{...credentials , path: data.path ? data.path : '/'} }
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
    let user_id = data.hostname
    let query = {}

    for (const [key, value] of data.searchParams) {
      query[key] = value
    }

    let result = {
      user_id,
      path: data.pathname || '/',
      ...query
    }
    if( name ) result.name = name
    return result
  }

  /**
   * Create id
   *
   * @param {object}
   * @param {string} [agrs]
   * @param {string} [agrs.user_id]
   * @param {string} [agrs.password]
   * @param {string} [agrs.cookie]
   * @return {string}
   * @api public
   */
  stringify({ user_id, path, ...query }) {
    return urlFormat({
      protocol: protocol,
      slashes: true,
      hostname: user_id,
      pathname: (path == '') ? '/' : path,
      query,
    })
  }

  install(msg) {
    return { id:`${protocol}-install`, type: 'folder', protocol, body:`
      <div class="auth">
        <h3>Aliyun Drive 挂载向导</h3>
        ${ msg ? '<p style="font-size:12px;">'+msg+'</p>' : '' }
        <div>
          <form class="form-horizontal" method="post">
            <input type="hidden" name="act" value="install" />
            <div class="form-group"><input class="sl-input" type="text" name="refresh_token" value="" placeholder="refresh_token" /></div>
            <div class="form-group"><input class="sl-input" type="text" name="rootPath" value="" placeholder="初始地址" /></div>
            <p style="font-size:11px;color:#555;">初始地址 可用于选定初始文件夹。留空时sharelist会匹配默认值。 <br><br>https://www.aliyundrive.com/drive/folder/xxxxxxxxxxx</p>
            <button class="sl-button btn-primary" id="signin" type="submit">确定</button></form>
        </div>
      </div>
    `}
  }

  error(data, mount = true) {
    return { id:'teambition-unmounted', type: 'folder', protocol, body: `
      <div class="auth">
        ${ mount ? '<h3>Teambition 挂载向导</h3>' : '' }
        <p style="font-size:12px;">${data}<br /></p>
        ${ mount ? '<p><a style="font-size:12px;cursor:pointer;" onclick="location.href=location.pathname">点击重新开始</a></p>' : '' }
      </div>
    `}
  }

  /**
   * Get cookie
   *
   * @param {string} [user_id]
   * @param {string} [password]
   * @param {string} [path]
   * @return {object}
   * @api private
   */
  async create({refresh_token , path}) {
    //0 准备工作： 获取必要数据
    let resp
    try{
      resp = await this.helper.request.post('https://auth.aliyundrive.com/v2/account/token', { 
        refresh_token, 
        grant_type: "refresh_token"
      }, {
        headers: {
          'User-Agent': 'None',
        },
        body:true,
        json:true
      })
    }catch(e){
      resp = e
    }

    if( !resp || !resp.body || !resp.body.access_token) return { error: true, msg: '无法获取登录token' }

    let { user_id , access_token , default_drive_id:drive_id , expires_in } = resp.body
    
    refresh_token = resp.body.refresh_token
    
    let expires_at = Date.now() + expires_in * 1000

    let client = { user_id, access_token, refresh_token, expires_at, drive_id, path }

    this.clientMap[user_id] = client

    await this.updateDrives(this.stringify(client))

    return { error:false }
  }

  async refreshAccessToken(hit){
    return await this.create(hit)
  }

  async update(id) {
    let data = this.parse(id)
    if (data.user_id) {
      let hit = this.clientMap[data.user_id]
      if (hit) {
        return await this.create(hit)
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

    let { credentials, error, msg, unmounted } = await this.get(id)
    if( unmounted ){
      let data
      if (req.body && req.body.refresh_token && req.body.act == 'install') {
        let { refresh_token, rootPath } = req.body
        let options = { refresh_token }
        rootPath = (rootPath.match(/(?<=\/folder\/)([^\/]+)/) || [''])[0]
        options.path = rootPath ? `/${rootPath}/` : '/'

        let { error, msg } = await this.create(options)
        if (error) {
          data = this.error(msg)
        } else {
          data = {
            id:`${protocol}-redirect`,
            type: 'folder',
            protocol: protocol,
            redirect:baseUrl
          }
        }
      }else{
        data = this.install()
      }
      return { ready:false, data}
    }else{
      if( error ){
        return { ready:false, data:this.error(msg) }
      }else{
        return { ready:true, data:credentials }
      }
    }

  }
}

/*class Guide {
  constructor(app) {
    this.path = '__teambition_guide__'
    this.init()
  }

  init(){

    let router = app.router().get(this.path, onGet)
    app.web().use(router.routes)
  }

  async onGet(ctx, next){

  }

  async onPost(ctx, next){

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

  install(){

  }
}*/

module.exports = class Driver {
  constructor(helper , app) {
    this.name = 'AliyunDrive'
    this.label = 'Aliyun Drive (beta)'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 10 * 60 * 1000
    this.max_age_cookie = 5 * 24 * 60 * 60 * 1000 // 5 days

    this.manager = Manager.getInstance(app, helper)

    this.helper = helper

    this.init()
  }

  async init() {
    let drives = await this.helper.getDrives()
    this.manager.init(drives)
  }

  async fetch(){

  }

  /**
   * Get data by path
   *
   * @param {string} [id] path id 
   * @return {object}
   * @api private
   */
  async path(id) {
    let { manager, protocol, helper } = this

    let { ready, data } = await manager.prepare(id)

    if( !ready ) return data

    let { path, access_token , drive_id, user_id } = data

    id =  manager.stringify({user_id,path})

    let r = helper.cache.get(id)

    if (r) {
      if (
        r.$cached_at &&
        r.children &&
        (Date.now() - r.$cached_at < this.max_age_dir)

      ) {
        console.log(Date.now() + ' CACHE AliyunDrive ' + id)
        return r
      }
    }


    let is_folder = path.endsWith('/')

    let [ parent_file_id , file_id ] = path.replace(/(^\/|\/$)/g, '').split('/')

    if(!parent_file_id){
      parent_file_id = 'root' 
    }

    if (is_folder) {
      let children = [] , marker , ts = Date.now()

      do{
        let resp
        let params = {
          drive_id, 
          parent_file_id,
          limit:200
        }

        if( marker ){
          params.marker = marker
        }

        try { 
          resp = await this.helper.request.post(`https://api.aliyundrive.com/v2/file/list`,params,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
                'Authorization': access_token,
              },
              body:true, 
              json:true
            }
          )
        }catch(e){
          console.log(e)
        }

        if (!resp.body) return false

        if (!resp.body.items) return manager.error('error', false)

        for(let i of resp.body.items){
          children.push({
            id: manager.stringify({
              user_id,
              path: i.type == 'folder' ? `/${i.file_id}/` : `/${parent_file_id}/${i.file_id}`
            }),
            name: i.name,
            ext: i.file_extension,
            protocol,
            size: i.size,
            created_at: i.created_at,
            updated_at: i.updated_at,
            type: i.type == 'folder' ? 'folder' : 'file',
            $download_url:i.download_url,
            $cached_at: ts
          })
        }

        marker = resp.body.next_marker

      }while( marker )

      let result = {
        id,
        path,
        type: 'folder',
        protocol: protocol,
        $cached_at: ts,
        children
      }
      helper.cache.set(id, result)
      return result
    } else {
      let parent_id = manager.stringify({ user_id, path: `/${parent_file_id}/` })

      let parent_data = await this.path(parent_id)

      let hit = parent_data.children.find(i => i.id == id)

      if (!hit) return false

      let expired_at = Date.now() + 50 * 1000
      let download_url = hit.$download_url

      return {
        id,
        url: download_url,
        name: hit.name,
        ext: hit.ext,
        protocol: protocol,
        size: hit.size,
        // $expired_at: expired_at,
        // proxy:true,
        headers:{
          'referer': 'https://www.aliyundrive.com/',
          'Referrer-Policy':'no-referrer',
          //'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36'
        }
      }

    }

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

  async createReadStream({ id, options = {} } = {}) {

  }
}