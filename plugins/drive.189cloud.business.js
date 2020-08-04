/**
 * 189 Cloud Business
 */

const { URL } = require('url')

const urlFormat = require('url').format

const protocol = 'ctcb'

/**
 * auth manager class
 */
class Manager {
  static getInstance(helper){
    if( !this.instance ){
      this.instance = new Manager(helper)
    }
    return this.instance
  }

  constructor(helper) {
    this.clientMap = {}
    this.helper = helper
  }

  /**
   * Update config
   *
   * @param {string} [client]
   * @api private
   */
  async updateDrives(client){
    const { helper } = this

    let paths = await helper.getDrives()
    let data = paths.map(i => this.parse(i.path , i.name))
    let name = decodeURIComponent(helper.getRuntime('req').path.replace(/^\//g,''))
    let hit = data.filter(i => i.name == name)

    //路径也无法匹配
    if( hit.length == 0 ){
      //仅有一个可用挂载源
      if(data.length == 1 && paths.length == 1 && paths[0].root){
        hit = data
      }
    }

    hit.forEach(i => {
      helper.saveDrive(client , i.name)
    })
  }

  /**
   * Recognize verify code
   *
   * @param {string} [image] image base64 data
   * @return {string} verify code
   * @api private
   */
  async ocr(image) {
    let resp = await this.helper.recognize(image, '189cloud')
    let ret = { error: resp.error, msg: resp.msg }
    if (!resp.error) {
      let code = resp.result.replace(/[^a-z0-9]/i, '')
      // retry
      if (code.length == 4) {
        ret.code = code
      } else {
        ret.code = ''
      }
    }

    return ret
  }

  init(d) {
    for (let i of d) {
      let data = this.parse(i.path)
      this.clientMap[data.username] = data
    }
  }

  /**
   * Get cookie/ by id
   *
   * @param {string} [id]
   * @return {object}
   * @api public
   */
  async get(id) {
    let data = this.parse(id)
    if (data.username) {
      let hit = this.clientMap[data.username]
      if (hit) {
        if (!hit.cookie || (Date.now() - hit.updated_at) > this.max_age_cookie) {
          let { result, msg } = await this.create(hit.username, hit.password)
          if (result) {
            hit = this.clientMap[data.username]
          } else {
            return { error: msg }
          }
        }
      }

      if (hit) {
        return { ...hit, path: data.path }
      } else {
        return { error: '挂载失败，请确保账号或者密码正确' }
      }
    }

    return { error: '' }
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
    return {
      name,
      username: data.hostname,
      password: data.searchParams.get('password'),
      cookie: data.searchParams.get('cookie'),
      protocol: data.protocol.split(':')[0],
      path: data.pathname.replace(/^\//, ''),
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
  stringify({ path, username, password, cookie }) {
    let query = {}
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

  async install(msg) {
    return `
      <div class="auth">
        <h3>天翼企业云 挂载向导</h3>
        ${ msg ? '<p style="font-size:12px;">'+msg+'</p>' : '' }
        <div>
          <form class="form-horizontal" method="post">
            <input type="hidden" name="act" value="install" />
            <div class="form-group"><input class="sl-input" type="text" name="username" value="" placeholder="用户名" /></div>
            <div class="form-group"><input class="sl-input" type="password" name="password" value="" placeholder="密码" /></div>
            <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
        </div>
      </div>
    `
  }

  /**
   * Check captcha
   *
   * @param {object} [formdata]
   * @param {string} [cookie]
   * @return {boolean}
   * @api private
   */
  async needcaptcha(formdata, cookie) {
    let resp = await this.helper.request.post('https://open.e.189.cn/api/logbox/oauth2/needcaptcha.do', formdata, {
      headers: {
        cookie: cookie,
        Referer: 'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do'
      },
    })
    if (resp.body && resp.body == '1') {
      return true
    } else {
      return false
    }
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
  async create(username, password, path = '/') {
    //0 准备工作： 获取必要数据
    let headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36' }
    let { body, headers: headers2 } = await this.helper.request.get('https://b.cloud.189.cn/unifyLogin.action?source=2&redirectURL=/main.action', { headers })

    let captchaToken = (body.match(/name='captchaToken' value='(.*?)'>/) || ['', ''])[1],
      returnUrl = (body.match(/returnUrl = '(.*?)'\,/) || ['', ''])[1],
      paramId = (body.match(/var paramId = "(.*?)";/) || ['', ''])[1],
      lt = (body.match(/var lt = "(.*?)";/) || ['', ''])[1],
      reqId = (body.match(/reqId = "(.*?)";/) || ['', ''])[1],
      appKey = (body.match(/appKey = '(.*?)'/) || ['', ''])[1]

    let cookie = headers2['set-cookie'].join('; ')

    let formdata = {
      'appKey': appKey,
      'accountType': '02',
      'userName': username,
      'password': password,
      'validateCode': '',
      'captchaToken': captchaToken,
      'returnUrl': returnUrl,
      'mailSuffix': '',
      'dynamicCheck': 'FALSE',
      'clientType': '10100',
      'cb_SaveName': '1',
      'isOauth2': 'false',
      'state': '',
      'paramId': paramId
    }

    let result = false
    let msg = ''
    let needcaptcha = await this.needcaptcha({
      accountType: '02',
      userName: username,
      appKey: appKey,
    }, cookie)
    console.log('needcaptcha:', needcaptcha)

    while (true) {
      // 0 验证码
      if (needcaptcha) {

        let captchaUrl = `https://open.e.189.cn/api/logbox/oauth2/picCaptcha.do?token=${formdata.captchaToken}&REQID=${reqId}&rnd=${Date.now()}`

        let resp = await this.helper.request.get(captchaUrl, {
          headers: {
            Cookie: cookie,
            Referer: 'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do'
          },
          encoding: null
        })

        let imgBase64

        if (resp.body) {
          imgBase64 = "data:" + resp.headers["content-type"] + ";base64," + Buffer.from(resp.body).toString('base64');
        }
        let { error, code } = await this.ocr(imgBase64)
        console.log('validateCode:[' + code + ']')

        //服务不可用
        if (error) {
          formdata.validateCode = ''
          msg = '验证码识别接口无法使用'
          break;
        } else if (code) {
          formdata.validateCode = code
        }
        //无法有效识别
        else {
          continue;
        }

      }

      // 1 登陆
      let resp = await this.helper.request.post('https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do', formdata, {
        headers: {
          'Referer': 'https://cloud.189.cn/udb/udb_login.jsp?pageId=1&redirectURL=/main.action',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          'REQID': reqId,
          'lt': lt,
        },
        json: true
      })

      //验证码错误
      if (resp.body.result == -2) {
        console.log('validateCode:[' + formdata.validateCode + '] error')

        continue;
      }

      if (resp.body && resp.body.toUrl) {
        resp = await this.helper.request.get(resp.body.toUrl, { followRedirect: false, headers })
        let cookie = resp.headers['set-cookie'].join('; ')
        let client = { username, password, cookie, updated_at: Date.now(), path }
        if (this.clientMap[username]) {
          client.path = this.clientMap[username].path
        }

        this.clientMap[username] = client

        await this.updateDrives(this.stringify({ username, password, path: client.path }))

        result = true
        break;
      } else {
        msg = resp.body.msg
        break;
      }

    }

    return { result, msg }
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

    let { path, cookie, username, error } = await this.get(id)

    if (error) {
      return { id, type: 'folder', protocol, body: this.install(error) }
    }

    if (cookie) {
      return { cookie, path, username }
    } else {
      if (req.body && req.body.username && req.body.password && req.body.act == 'install') {
        let { username, password } = req.body
        let { result, msg } = await this.create(username, password)
        if (result) {
          return { id, type: 'folder', protocol: protocol, redirect: req.origin + req.path }
        } else {
          return { id, type: 'folder', protocol: protocol, body: await this.install(msg || '请确认账号密码正确') }
        }
      }

      return { id, type: 'folder', protocol: protocol, body: await this.install(error) }
    }

  }
}


/**
 * 
 * 
 */
class CTCB {
  constructor(helper) {
    this.name = '189CloudBusinessCookie'
    this.label = '天翼企业云 账号密码版'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 10 * 60 * 1000
    this.max_age_cookie = 5 * 24 * 60 * 60 * 1000 // 5 days

    this.manager = Manager.getInstance(helper)

    this.helper = helper

    this.init()
  }

  async init(){
    let drives = await this.helper.getDrives()
    this.manager.init(drives)
  }

  async fetchData(id,rest) {
    let resp , retry_times = 5
    while(true && --retry_times){
      resp = await this.helper.request({async:true,...rest})
      //cookie失效
      if(resp.headers['Content-Type'] && resp.headers['Content-Type'].includes('text/html')){
        let { result , msg } = await manager.update(id)
        if( result ){
          resp = { msg }
          break;
        }else{
          continue
        }
      }else{
        break;
      }
    }
    
    return resp
  }

  /**
   * Create root data 
   *
   * @param {string} [id] path id
   * @param {string} [username] username
   * @param {string} [corpId] company ID
   * @return {object}
   * @api private
   */
  getComapanyRoot(id, username, corpId) {
    let { protocol , manager } = this
    return {
      id,
      type: 'folder',
      protocol,
      children: [{
          id: manager.stringify({ username, path: `/companyFiles/corp/${corpId}` }),
          name: '企业空间',
          type: 'folder',
          protocol,
        },
        {
          id: manager.stringify({ username, path: `/shareFolders/corp/${corpId}` }),
          name: '协作空间',
          type: 'folder',
          protocol,
        },
        {
          id: manager.stringify({ username, path: `/workFiles/corp/${corpId}` }),
          name: '工作空间',
          type: 'folder',
          protocol,
        }
      ]
    }
  }

  /**
   * Get data by path
   *
   * @param {string} [id] path id
   * @return {object}
   * @api private
   */
  async path(id) {
    let { manager , protocol , helper } = this

    let data = await manager.prepare(id)

    if (!data.cookie) return data

    let { path, cookie, username } = data

    let r = helper.cache.get(id)
    if (r) {
      if (
        r.$cached_at &&
        r.children &&
        (Date.now() - r.$cached_at < this.max_age_dir)

      ) {
        console.log(Date.now() + ' CACHE 189CloudBusiness ' + id)
        return r
      }
    }


    // list company
    if (!path) {
      let resp = await this.fetchData(id, {
        url: `https://b.cloud.189.cn/user/listCorp.action`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          'Cookie': cookie,
        },
        json: true
      })

      if (resp.body.data.length) {
        return {
          id,
          type: 'folder',
          protocol: protocol,
          children: resp.body.data.map(i => {
            return {
              id: manager.stringify({ username, path: i.corpId }),
              name: i.corpName,
              type: 'folder',
              protocol: protocol,
              created_at: i.createTime,
              updated_at: i.modifyTime
            }
          })
        }

      }
      return false
    } 
    // ctcb://username/:corpId?password
    else if (path.includes('/') == false) {
      return this.getComapanyRoot(id, username, path)
    }

    // ctcb://username/:type/corp/:corpId/:folderId/:fileId
    let pathArgs = path.replace(/(^\/|\/$)/,'').split('/')
    let [type, _, corpId, folderId, fileId] = pathArgs
    let basePath = '/'+[type, _, corpId].join('/')

    const pathsMap = {
      'companyFiles':'listCompanyFiles',
      'workFiles':'listWorkFiles',
      'shareFolders':'listJoinCorpCoshare',
    }

    type = pathsMap[type]

    // console.log(type,corpId,folderId,fileId)
    if( corpId && !fileId ){
      let children = [],pageNum = 1

      while (true) {
        let resp = await this.fetchData(id, {
          url: `https://b.cloud.189.cn/user/${type}.action?corpId=${corpId}&fileId=${folderId || ''}&mediaType=&orderBy=1&order=ASC&pageNum=1&pageSize=9999&recursive=false&noCache=${Math.random()}`,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
            'Cookie': cookie,
          },
          json: true
        })
        if (!resp || !resp.body) {
          return { id, type: 'folder', protocol: protocol, body: resp.msg || '解析错误' }
        }
        for (let file of resp.body.data) {
          let isFolder = file.isFolder
          let item = {
            id: manager.stringify({ username, path: (isFolder ? basePath : path) + '/' + file.fileId }),
            name: file.fileName,
            protocol: protocol,
            created_at: file.createTime,
            updated_at: file.lastOpTime,
            type: file.isFolder ? 'folder' : 'file',
          }

          if (!isFolder) {
            item.ext = file.fileType
            item.size = parseInt(file.fileSize)
            item.url = 'https:' + file.downloadUrl
            if (file.icon) item.icon = file.icon.smallUrl
          }

          children.push(item)
        }

        let count = resp.body.recordCount
        let currentCount = resp.body.pageNum * resp.body.pageSize

        if (currentCount < count) {
          //翻页
          pageNum++
          continue
        } else {
          break;
        }
      }

      let result = { id, type: 'folder', protocol }
      result.$cached_at = Date.now()
      result.children = children
      helper.cache.set(id, result)

      return result
    }
    else if(folderId && fileId){
      let parentId = manager.stringify({ username, path: pathArgs.slice(0,-1).join('/') })

      let parentData = await this.path(parentId)

      let data = parentData.children.find(i => i.id == id )
      if( !data ) return false
      let resp = await this.fetchData(id,{
        url:data.url,
        method:'GET',
        followRedirect:false ,
        headers:{
          'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          'Cookie': cookie,
        }
      })
      if(!resp) return false

      let url = resp.headers.location
      resp = {
        id,
        url,
        name: data.name,
        ext: data.ext,
        protocol: protocol,
        size:data.size,
      }

      return resp
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
  async folder(id){
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
  async file(id){
    return await this.path(id)
  }

  async createReadStream({ id, options = {} } = {}) {
    
  }

}


module.exports = CTCB