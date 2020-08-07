/**
 * 189 Cloud Business
 */

const { URL } = require('url')

const urlFormat = require('url').format

const protocol = 'ctch'

const crypto = require('crypto')

const hmac = (v , key) => {
  return crypto.createHmac('sha1', key).update(v).digest('hex')
}

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
        if (!hit.sessionKey || (Date.now() - hit.updated_at) > this.max_age_cookie) {
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
      sessionKey: data.searchParams.get('sessionKey'),
      sessionSecret: data.searchParams.get('sessionSecret'),
      familyId: data.searchParams.get('familyId'),
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
   * @param {string} [agrs.sessionKey]
   * @param {string} [agrs.sessionSecret]
   * @return {string}
   * @api public
   */
  stringify({ path, username, ...query }) {
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
        <h3>天翼家庭云 挂载向导</h3>
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
    let { body, headers: headers2 } = await this.helper.request.get(`https://cloud.189.cn/unifyLoginForPC.action?appId=8025431004&clientType=10020&returnURL=https%3A%2F%2Fm.cloud.189.cn%2Fzhuanti%2F2020%2FloginErrorPc%2Findex.html&timeStamp=${Date.now()}`, { headers })

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
      'clientType': '10020',
      'cb_SaveName': '0',
      'isOauth2': 'false',
      'state': '',
      'paramId': paramId
    }

    let result = false, msg = ''
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

      if (resp.body && !resp.body.toUrl){
        msg = resp.body.msg
        break;
      }

      // get Session
      try{
        resp = await this.helper.request.post( `https://api.cloud.189.cn/getSessionForPC.action?redirectURL=${encodeURIComponent(resp.body.toUrl)}&clientType=TELEPC&version=6.2.5.0&channelId=web_cloud.189.cn`)
      }catch(e){
        msg = '无法登录'
        break;
      }

      resp = await this.helper.xml2json(resp.body)

      let sessionKey = resp.userSession.familySessionKey[0]
      let sessionSecret = resp.userSession.familySessionSecret[0]

      //获取 family id

      let date = new Date().toGMTString()
      let signature = hmac(`SessionKey=${sessionKey}&Operate=GET&RequestURI=/family/manage/getFamilyList.action&Date=${date}`,sessionSecret)
      resp = await this.helper.request.get('https://api.cloud.189.cn/family/manage/getFamilyList.action?clientType=TELEPC&version=6.3.0.0&channelId=web_cloud.189.cn&rand='+Math.random(),{
        headers:{
          'Date':date,
          'SessionKey':sessionKey,
          'Signature': signature,
        }
      })
      if(!( resp && resp.body && resp.body.includes('<familyId>')) ){
        msg = '无法获取到家庭云'
        break
      }

      let familyId = (resp.body.match(/<familyId>(\d+)<\/familyId>/) || ['',''])[1]
      
      let client = { 
        username, password, updated_at: Date.now(), 
        path : '/'+familyId,
        familyId,
        sessionKey,
        sessionSecret
      }

      this.clientMap[username] = client

      await this.updateDrives(this.stringify({ username, password, path: client.path , sessionKey, sessionSecret,familyId }))

      result = true

      break;
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

    let { path, sessionKey, sessionSecret, username, error } = await this.get(id)
    console.log('>>>>',id,path, sessionKey, sessionSecret, username, error)
    if (error) {
      return { id, type: 'folder', protocol, body: this.install(error) }
    }

    if (sessionKey) {
      return { sessionKey, sessionSecret, path, username }
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
class CTCH {
  constructor(helper) {
    this.name = '189CloudHomeCookie'
    this.label = '天翼家庭云 账号密码版'
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

  async fetch(operate = 'GET' , url , credentials , qs) {
    let { sessionKey, sessionSecret } = credentials
    let date = new Date().toGMTString()
    let signature = hmac(`SessionKey=${sessionKey}&Operate=${operate}&RequestURI=${url}&Date=${date}`,sessionSecret)

    let headers = {
      'Date':date,
      'SessionKey': sessionKey,
      'Signature': signature,
    }
    let resp
    try{
      let r = await this.helper.request({
        url:`https://api.cloud.189.cn${url}`,
        headers,
        method:operate,
        qs, json:true,
        async:true,
      })

      resp = await this.helper.xml2json(r.body)
      if(resp.error){
        resp.error = resp.error.message[0]
      }
    }catch(e){
      resp = { error:'request error' }
    }

    return resp
    
  }
  
  /**
   * Get data by path
   *
   * @param {string} [id] path id
   * @return {object}
   * @api private
   */
  async path(id) {
    let { manager , protocol , helper , max_age_dir } = this

    let data = await manager.prepare(id)

    if (!data.sessionKey) return data

    let { path, sessionKey, sessionSecret, username } = data

    let r = helper.cache.get(id)

    if (r) {
      if (
        (
          r.$expired_at && Date.now() < r.$expired_at
        )
        || 
        (
          r.$cached_at &&
          r.children &&
          (Date.now() - r.$cached_at < max_age_dir)
        )
      ) {
        console.log(Date.now()+' CACHE 189CloudHome '+ id)
        return r
      }
    }


    let pathArgs = path.replace(/(^\/|\/$)/,'').split('/')

    let [familyId, folderId = -1, fileId] = pathArgs

    if( !fileId ){
      let children = [],pageNum = 1
      while (true) {
        let resp = await this.fetch('GET','/family/file/listFiles.action', data , {
          folderId:folderId == -1 ? '':folderId , 
          familyId, 
          fileType:0,
          iconOption:1,
          mediaAttr:22,
          orderBy:1,
          descending:false,
          pageNum:pageNum,
          pageSize:9999,
          clientType:'TELEPC',
          version:'6.3.0.0',
          channelId:'web_cloud.189.cn',
          rand:Math.random()
        })

        if (resp.error) {
          return {
            id, type: 'folder', protocol: protocol,body:resp.error
          }
        }

        ;(resp.listFiles.fileList[0].folder || [])
        .map(i => ({...i , isFolder:1}))
        .concat(resp.listFiles.fileList[0].file || [])
        .forEach( file => {
          let isFolder = file.isFolder
          let item = {
            id: manager.stringify({ username, path: (isFolder ? `/${familyId}` : `/${familyId}/${folderId}`) + '/' + file.id[0] }),
            name: file.name[0],
            protocol: protocol,
            created_at: file.createDate[0],
            updated_at: file.lastOpTime[0],
            type: file.isFolder ? 'folder' : 'file',
          }

          if (!isFolder) {
            item.ext = file.name[0].split('.').pop()
            item.size = parseInt(file.size[0])
            item.md5 = file.md5[0]
            if (file.icon) item.icon = file.icon[0].smallUrl
          }

          children.push(item)
        })

        break;
        // let count = parseInt(resp.listFiles.fileList[0].count)
        // let currentCount = resp.body.pageNum * resp.body.pageSize

        // if (currentCount < count) {
        //   //翻页
        //   pageNum++
        //   continue
        // } else {
        //   break;
        // }
      }

      let result = { id, type: 'folder', protocol }
      result.$cached_at = Date.now()
      result.children = children
      helper.cache.set(id, result)

      return result
    }
    else if(fileId){

      let parentId = manager.stringify({ username, path: pathArgs.slice(0,-1).join('/') })

      let parentData = await this.path(parentId)

      let hit = parentData.children.find(i => i.id == id )

      if( !hit ) return false

      let resp = await this.fetch('GET','/family/file/getFileDownloadUrl.action',data,{
        familyId,
        fileId,
        clientType:'TELEPC',
        version:'6.3.0.0',
        channelId:'web_cloud.189.cn',
        rand:Math.random()
      })

      if (resp.error) {
        return {
          id, type: 'folder', protocol: protocol,body:resp.error
        }
      }

      let expired_at = parseInt((resp.fileDownloadUrl.match(/(?<=expired=)\d+/) || [0])[0])
      let downloadUrl = resp.fileDownloadUrl
      console.log( downloadUrl )
      resp = {
        id,
        url: downloadUrl,
        name: hit.name,
        ext: hit.ext,
        protocol: protocol,
        size:hit.size,
        $expired_at:expired_at - 5000,
        $cached_at:Date.now(),
      }

      helper.cache.set(id, resp)

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

  async mkdir(id , name){
    let { protocol , manager , helper } = this

    let data = await manager.prepare(id)

    if (!data.sessionKey) return data

    let { path, sessionKey, sessionSecret, username } = data

    let [familyId , parentId = -1] = path.replace(/(^\/|\/$)/,'').split('/')

    let resp = await this.fetch('GET','/family/file/createFolder.action', data , {
      familyId, 
      parentId:parentId == -1 ? '':parentId, 
      folderName:name,
      relativePath:'',
      clientType:'TELEPC',
      version:'6.3.0.0',
      channelId:'web_cloud.189.cn',
      rand:Math.random()
    })

    if (resp.error) {
      return false
    }

    //success
    return true
    
  }

  async createReadStream({ id, options = {} } = {}) {
    let resp = await this.file(id)
    if(resp.body){
      return resp
    }else{
      let readstream = request({url:resp.url , method:'get'})
      return this.helper.wrapReadableStream(readstream , { size: resp.size } )
    }
  }

}


module.exports = CTCH