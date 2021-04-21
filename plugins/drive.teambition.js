/**
 * Teambition Drive
 *
 * teambition://username/orgId/driveId/folderId/?password
 * teambition://username/orgId/driveId/folderId/fileId?password
 */
const { URL } = require('url')

const urlFormat = require('url').format

const protocol = 'teambition'

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
      this.clientMap[data.username] = data
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
    if (data.username && this.clientMap[data.username]) {
      let credentials = this.clientMap[data.username]

      //更新cookie
      if (!credentials.cookie || (Date.now() - credentials.updated_at) > this.max_age_cookie) {
        let result = await this.update(id)
        if( result.error ){
          return result
        }else{
          credentials = this.clientMap[data.username]
        }
      }

      return { credentials:{ ...credentials, path:data.path} }
    }

    return { error:'unmounted', unmounted: true }
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
    let [tenantId, driveId, rootId] = data.pathname.replace(/^\//, '').split('/')

    return {
      name,
      username: data.hostname,
      password: data.searchParams.get('password'),
      cookie: data.searchParams.get('cookie'),
      protocol: data.protocol.split(':')[0],
      path: data.pathname.replace(/^\//, ''),
      tenantId, driveId, rootId
    }
  }

  /**
   * Create id
   *
   * @param {object}
   * @param {string} [agrs]
   * @param {string} [agrs.username]
   * @param {string} [agrs.password]
   * @param {string} [agrs.cookie]
   * @return {string}
   * @api public
   */
  stringify({ path, username, password, cookie, query = {} }) {
    if (password) query.password = password
    if (cookie) query.cookie = cookie
    return urlFormat({
      protocol: protocol,
      hostname: username,
      pathname: (path == '') ? '/' : path,
      slashes: true,
      query,
    })
  }

  install(msg) {
    return { id:`${protocol}-install`, type: 'folder', protocol, body:`
      <div class="auth" style="width:500px;">
        <h3>Teambition 挂载向导</h3>
        ${ msg ? '<p style="font-size:12px;">'+msg+'</p>' : '' }
        <div>
          <form class="form-horizontal" method="post">
            <input type="hidden" name="act" value="install" />
            <div class="form-group"><input class="sl-input" type="text" name="username" value="" placeholder="用户名" /></div>
            <div class="form-group"><input class="sl-input" type="password" name="password" value="" placeholder="密码" /></div>
            <div class="form-group"><input class="sl-input" type="text" name="rootPath" value="" placeholder="初始地址 " /></div>
            <p style="font-size:11px;color:#555;">初始地址 可用于选定初始文件夹 或 初始项目。留空时sharelist会匹配默认值。 <br><br>绑定网盘<br />https://www.teambition.com/pan/org/xxxxxx/space/xxxxxx/folder/xxxxxx<br /><br>绑定项目<br />https://www.teambition.com/project/xxxxxx/works/xxxxxx</p>
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
   * @param {string} [username]
   * @param {string} [password]
   * @param {string} [path]
   * @return {object}
   * @api private
   */
  async create(username, password, {tenantId , driveId, rootId}) {
    //0 准备工作： 获取必要数据
    let { body, headers: headers2 } = await this.helper.request.get('https://account.teambition.com/login/password', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
      }
    })
    let config = {}
    try {
      let str = (body.match(/\{"NAME".*?\}(?=[\n\r])/) || [''])[0]
      config = JSON.parse(str)
    } catch (e) {
      console.log(body)
    }
    if (!config.TOKEN) {
      return { error: true, msg: '无法获取登录token' }
    }

    let cookie = headers2['set-cookie'].join('; ')

    let formdata = {
      "password": password,
      "token": config.TOKEN,
      "client_id": config.CLIENT_ID,
      "response_type": "session",
      "phone": username
    }

    let error = true
    let msg = ''
    // 1 登陆
    let resp = await this.helper.request({
      url:'https://account.teambition.com/api/login/phone', 
      body:formdata,
      method:'post',
      headers: {
        'Referer': 'https://account.teambition.com/login/password',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        'origin': 'https://account.teambition.com',
        cookie,
      },
      async:true,
      json: true
    })
    
    //密码错误
    if (resp.body && resp.body.status == 400) {
      msg = resp.body.message
    } else {
      let userId = resp.body.user._id

      let cookie = resp.headers['set-cookie'].join('; ')

      //获取 orgId
      if (!tenantId) {
        resp = await this.helper.request.get('https://www.teambition.com/api/organizations/personal', {
          headers: {
            'Referer': 'https://www.teambition.com/projects',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
            cookie,
          },
          json: true
        })

        if (resp.body && resp.body._id) {
          tenantId = resp.body._id
        }
      }

      //获取driveId
      if(tenantId != 'project' && !driveId){
        //获取 driveId
        resp = await this.helper.request.get(`https://pan.teambition.com/pan/api/orgs/${tenantId}?orgId=${tenantId}`, {
          headers: {
            'Referer': 'https://www.teambition.com/projects',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
            cookie,
          },
          json: true
        })

        if (resp.body && resp.body.success) {
          driveId = resp.body.data.driveId
        }
      }

      if (!rootId) {
        resp = await this.helper.request.get(`https://pan.teambition.com/pan/api/spaces?orgId=${tenantId}&memberId=${userId}`, {
          headers: {
            'Referer': 'https://www.teambition.com/projects',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
            'origin': 'https://www.teambition.com',
            'referer': 'https://www.teambition.com/',
            cookie,
          },
          json: true
        })

        if (resp.body && resp.body.length) {
          rootId = resp.body[0].rootId
        }
      }

      let client = { username, password, userId, tenantId, driveId, rootId, cookie, updated_at: Date.now(), path:`/${tenantId}/${driveId}/${rootId}/` }

      this.clientMap[username] = client

      await this.updateDrives(this.stringify({ username, password, path: client.path , cookie }))

      error = false
    }

    return { error, msg }
  }

  async update(id) {
    let data = this.parse(id)
    if (data.username) {
      let hit = this.clientMap[data.username]
      if (hit) {
        let options = {}
        if( hit.path ){
          let { tenantId,driveId,rootId } = hit
          options = { tenantId,driveId,rootId }
        }
        return await this.create(hit.username, hit.password , options)
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
      if (req.body && req.body.username && req.body.password && req.body.act == 'install') {
        let { username, password, rootPath } = req.body
        let options = {}
        let type = rootPath.includes('teambition.com/project') ? 'project' : 'disk'
        if(rootPath){
          if( type == 'disk' ){
            options.tenantId = (rootPath.match(/(?<=\/pan\/org\/)([^\/]+)/) || [''])[0]
            options.rootId = (rootPath.match(/(?<=\/folder\/)([^\/]+)/) || [''])[0]
          }else if( type == 'project' ){
            options.tenantId = 'project'
            options.driveId = (rootPath.match(/(?<=\/project\/)([^\/]+)/) || [''])[0]
            options.rootId = (rootPath.match(/(?<=\/works\/)([^\/]+)/) || [''])[0]
          }
        }
        let { error, msg } = await this.create(username, password, options)
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
    this.name = 'Teambition'
    this.label = 'Teambition (beta)'
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

  async fetchData(id, rest) {
    let resp, retry_times = 5
    while (true && --retry_times) {
      resp = await this.helper.request({ async: true, ...rest })
      //cookie失效
      if (resp.headers['Content-Type'] && resp.headers['Content-Type'].includes('text/html')) {
        let { result, msg } = await manager.update(id)
        if (result) {
          resp = { msg }
          break;
        } else {
          continue
        }
      } else {
        break;
      }
    }

    return resp
  }

  async pathForProject(id, {path, username, tenantId , driveId , folderId , cookie}){
    let { manager, protocol, helper } = this

    //folders
    let resp = await this.fetchData(id, {
      url:'https://www.teambition.com/api/collections',
      qs:{
        _parentId: folderId,
        _projectId: driveId,
        order: 'updatedDesc',
        count: 1000,
        page: 1,
        _: Date.now()
      },
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        'Origin': 'https://www.teambition.com',
        'Referer': 'https://www.teambition.com/',
        'Cookie': cookie,
      },
      json: true
    })

    if (!resp.body) return false

    if( resp.body.message ) return manager.error(resp.body.message, false)

    const ts = Date.now()

    let baseId = `/${tenantId}/${driveId}/`

    let children = resp.body.filter(i => !!i.title).map((i) => {
      return {
        id: manager.stringify({
          username,
          path: baseId + i._id
        }),
        name: i.title,
        protocol,
        size: i.size,
        created_at: i.created,
        updated_at: i.updated,
        type: 'folder',
        $cached_at: ts
      }
    })

    // files
    resp = await this.fetchData(id, {
      url:'https://www.teambition.com/api/works',
      qs:{
        _parentId: folderId,
        _projectId: driveId,
        order: 'updatedDesc',
        count: 1000,
        page: 1,
        _: Date.now(),
      },
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        'Origin': 'https://www.teambition.com',
        'Referer': 'https://www.teambition.com/',
        'Cookie': cookie,
      },
      json: true
    })

    if (!resp.body) return false
    if( resp.body.message ) return manager.error(resp.body.message, false)

    resp.body.forEach((i) => {
      children.push({
        id: manager.stringify({
          username,
          path: baseId + `${folderId}/${i._id}`
        }),
        name: i.fileName,
        ext: i.fileType,
        protocol,
        size: i.fileSize,
        created_at: i.created,
        updated_at: i.updated,
        type: 'fileCategory',
        thumb:i.thumbnail,
        $download_url:i.downloadUrl,
        $cached_at: ts
      })
    })

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
  }

  async pathForNode(id, { path, username, tenantId , driveId , folderId , cookie}){
    let { manager, protocol, helper } = this

    let resp = await this.fetchData(id, {
      url:'https://pan.teambition.com/pan/api/nodes',
      qs:{
        orgId: tenantId,
        offset: 0,
        limit: 10000,
        orderBy: 'updateTime',
        orderDirection: 'desc',
        driveId,
        parentId: folderId,
      },
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        'Origin': 'https://www.teambition.com',
        'Referer': 'https://www.teambition.com/',
        'Cookie': cookie,
      },
      json: true
    })

    if (!resp.body) return false

    if (!resp.body.data) return manager.error('error', false)

    const ts = Date.now()
    let baseId = `/${tenantId}/${driveId}/`

    let children = resp.body.data.map((i) => {
      return {
        id: manager.stringify({
          username,
          path: (baseId + (i.kind == 'folder' ? i.nodeId : `${folderId}/${i.nodeId}`))
        }),
        name: i.name,
        ext: helper.extname(i.name),
        protocol,
        size: i.size,
        created_at: i.created,
        updated_at: i.updated,
        type: i.kind == 'folder' ? 'folder' : 'other',
        mime: i.contentType,
        thumb:i.thumbnail,
        $download_url:i.downloadUrl,
        $cached_at: ts
      }
    })

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
  }
  /**
   * Get data by path
   *
   * @param {string} [id] path id 
   *    BT://username/orgId/driveId/folderId/
   *    BT://username/orgId/driveId/folderId/fileId
   * @return {object}
   * @api private
   */
  async path(id) {
    let { manager, protocol, helper } = this

    let { ready, data } = await manager.prepare(id)

    if( !ready ) return data

    let { path, cookie, username } = data

    id =  manager.stringify({username,path})

    let r = helper.cache.get(id)

    if (r) {
      if (
        r.$cached_at &&
        r.children &&
        (Date.now() - r.$cached_at < this.max_age_dir)

      ) {
        console.log(Date.now() + ' CACHE Teambition ' + id)
        return r
      }
    }


    let [tenantId, driveId, folderId , fileId ] = path.replace(/(^\/|\/$)/, '').split('/')

    let isFolder = !fileId

    if (isFolder) {
      if( tenantId == 'project' ){
        return await this.pathForProject(id , {path, username, tenantId, driveId, folderId , cookie })
      }else{
        return await this.pathForNode(id , {path, username, tenantId, driveId, folderId , cookie })
      }

    } else {
      let parentId = manager.stringify({ username, path: `/${tenantId}/${driveId}/${folderId}` })

      let parentData = await this.path(parentId)

      let hit = parentData.children.find(i => i.id == id)

      if (!hit) return false

      let expired_at = Date.now() + 50 * 1000
      let downloadUrl = hit.$download_url

      return {
        id,
        url: downloadUrl,
        name: hit.name,
        ext: hit.ext,
        protocol: protocol,
        size: hit.size,
        thumb:hit.thumb,
        // $expired_at: expired_at,
        // proxy:true,
        headers:{
          'referer': 'https://www.teambition.com/',
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