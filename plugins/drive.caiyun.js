/**
 * caiyun
 */

const { URL } = require('url')

const urlFormat = require('url').format

const NodeRSA = require('node-rsa')

const crypto = require('crypto')

const protocol = 'cy'

const md5 = (v) => {
  return crypto.createHash('md5').update(v).digest('hex')
}

const getRandomSring = (e) => {
  let n = ''
  for (let t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", a = 0; a < e; a++) {
    let o = Math.floor(Math.random() * t.length);
    n += t.substring(o, o + 1)
  }
  return n
}

const getSign = (params, extra, timestamp, rndstring) => {
  function serialize(e) {
    var t = [];
    for (var n in e)
      if (e[n] || 0 === e[n] || "0" === e[n] || !1 === e[n])
        if (e[n] instanceof Object && !(e[n] instanceof Array)) {
          if (e[n] !== {} && 0 !== Object.keys(e[n]).length) {
            var a = "{".concat(serialize(e[n]), "}"),
              o = n + "=" + a;
            t.push(o)
          }
        } else if (e[n] instanceof Array) {
      var r = e[n];
      if (0 !== r.length) {
        var s = "";
        for (var c in r)
          r[c] instanceof Object ? s = "".concat(s, "{").concat(serialize(r[c]), "}") : s += r[c],
          c < r.length - 1 && (s += ",");
        t.push(n + "=" + s)
      }
    } else {
      if ("string" === typeof e[n] && "" === e[n].trim())
        continue;
      t.push(n + "=" + e[n])
    }
    return 0 !== t.length ? (t = t.sort(),
      t.join("&")) : ""
  }

  let key = serialize(Object.assign({}, extra, params))
  key += (key ? '&' : '') + 'key=' + md5(timestamp + ':' + rndstring)

  return md5(key).toUpperCase()
}

const rsaEncrypt = (data, publicKey) => {
  publicKey = '-----BEGIN PUBLIC KEY-----\n'+publicKey+'\n-----END PUBLIC KEY-----'

  //前端 pkcs1 加密
  let key = new NodeRSA(publicKey, { encryptionScheme: 'pkcs1' });
  return key.encrypt(data, 'base64');
}

const aesEncrypt = (data, key, iv = "") => {
  let cipher = crypto.createCipheriv('aes-128-ecb', key, Buffer.from(iv, 'hex'));
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted
}

const moment = (a, expr = 'yyyy-MM-dd hh:mm:ss') => {

  const zeroize = (v) => {
    v = parseInt(v)
    return v < 10 ? "0" + v : v;
  }

  if (!a) a = new Date()
  if (expr == 'timestamp' || expr == 'ms') {
    return a.getTime()
  } else if (expr == 'iso' || expr == 'ISO') {
    return a.toISOString()
  } else if (expr == 'date') {
    return a
  }

  let y = a.getFullYear(),
    M = a.getMonth() + 1,
    d = a.getDate(),
    D = a.getDay(),
    h = a.getHours(),
    m = a.getMinutes(),
    s = a.getSeconds(),
    w = a.getDay();

  return expr.replace(/(?:s{1,2}|w{1,2}|m{1,2}|h{1,2}|d{1,2}|M{1,4}|y{1,4})/g, function(str) {

    switch (str) {
      case 's':
        return s;
      case 'ss':
        return zeroize(s);
      case 'm':
        return m;
      case 'mm':
        return zeroize(m);
      case 'h':
        return h;
      case 'hh':
        return zeroize(h);
      case 'd':
        return d;
      case 'w':
        return w;
      case 'ww':
        return w == 0 ? 7 : w;
      case 'dd':
        return zeroize(d);
      case 'M':
        return M;
      case 'MM':
        return zeroize(M);
      case 'MMMM':
        return ['十二', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一'][m] + '月';
      case 'yy':
        return String(y).substr(2);
      case 'yyyy':
        return y;
      default:
        return str.substr(1, str.length - 2);
    }
  })
}

const datetimeFormat = d => d ? d.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,'$1-$2-$3 $4:$5:$6') : ''

/**
 * auth manager class
 */
class Manager {
  static getInstance(helper) {
    if (!this.instance) {
      this.instance = new Manager(helper)
    }
    return this.instance
  }

  constructor(helper) {
    this.clientMap = {}
    this.helper = helper
    this.captchaProcess = {}
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

  /**
   * Recognize verify code
   *
   * @param {string} [image] image base64 data
   * @return {string} verify code
   * @api private
   */
  async ocr(image) {
    let resp = await this.helper.recognize(image, 'caiyun')
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
          let { result, error } = await this.create(hit.username, hit.password)
          if (error) {
            return { error }
          } else {
            hit = this.clientMap[data.username]
          }
        }
      }

      if (hit) {
        let p = (data.path == '/' || data.path == '') ? '00019700101000000001' : data.path
        return { ...hit, path: p }

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

  hasCaptchaTask(id) {
    return id in this.captchaProcess
  }

  async resumeCaptchaTask(id, captcha) {
    let { username, password } = this.captchaProcess[id]
    return await this.create(username, password, id, captcha)
  }

  async install(msg) {
    return `
      <div class="auth">
        <h3>和彩云 挂载向导</h3>
        ${ msg ? '<p style="font-size:12px;">'+msg+'</p>' : '' }
        <div>
          <form class="form-horizontal" method="post">
            <input type="hidden" name="act" value="install" />
            <div class="form-group"><input class="sl-input" type="text" name="username" value="" placeholder="用户名" /></div>
            <div class="form-group"><input class="sl-input" type="password" name="password" value="" placeholder="密码" /></div>
            <div class="form-group"><input class="sl-input" type="text" name="path" value="" placeholder="挂载目录，根目录请留空" /></div>
            <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
        </div>
      </div>
    `
  }

  async captchaPage(data) {
    return `
      <div class="auth">
        <h3>和彩云 挂载向导</h3>
        <p style="font-size:12px;">请输入验证码
          <img src="${data.img}" />
        </p>
        <div>
          <form class="form-horizontal" method="post">
            <input type="hidden" name="act" value="install" />
            <input type="hidden" name="username" value="${data.username}" />
            <input type="hidden" name="password" value="${data.password}" />
            <input type="hidden" name="path" value="${data.path}" />
            <input type="hidden" name="key" value="${data.key}" />
            <div class="form-group"><input class="sl-input" type="text" placeholder="验证码" name="captcha" value="" /></div>
            <button class="sl-button btn-primary" id="signin" type="submit">确定</button></form>
        </div>
      </div>
    `
  }

  async getPublicKey(){
    let resp = await this.fetch('/caiyun/openapi/authentication/key/getRsaPublicKey',{
      "clientCode":"0010101",
      "type":1
    })

    if( resp.body && resp.body.statusCode == 200 ) {
      return resp.body.data
    }
  }

  async fetch(url, body, options = {}) {
    let timestamp = Date.now()
    let key = getRandomSring(16)
    let headers = {
      'caller':'web',
      'CMS-CLIENT': '0010101',
      'CMS-DEVICE': 'default',
      'CMS-SIGN': timestamp + "," + key + "," + getSign(undefined, body, timestamp, key),
      'x-DeviceInfo': '||9|85.0.4183.83|chrome|85.0.4183.83|||windows 10||zh-CN|||'
    }

    let { method = 'POST' , skey , json = true } = options

    if( skey ){
      headers['CMS-SKey'] = skey
    }

    let data = {
      async: true,
      url: 'https://c.139.com' + url,
      method,
      headers: headers,
      body,
      ...options
    }
    
    if( json ) data.json = true

    return await this.helper.request(data)
  }

  async searchRootId(username,path){
    const req = this.helper.getRuntime('req')
    let id = this.stringify({ username, path:req.path + path  })
    let data = await this.helper.command('ls',req.path + path)
    if(data && data.id){
      data = this.parse(data.id)
      return data.path
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
  async create(username, password, captchaId, captcha, path) {
    let cookie
    let needcaptcha = false,
      retry = 0
    let formdata = {
      account: username,
      dycPwd: password,
      loginStyle: 'passPwd',
      verifyCode: ""
    }
    // console.log( captchaId, captcha,this.captchaProcess)
    if (captchaId && this.captchaProcess[captchaId]) {
      retry = 0
      needcaptcha = true
    }

    if (captcha) {
      formdata.verifyCode = captcha
    }

    let error = false


    let publicKey = await this.getPublicKey()
    console.log('publicKey',publicKey)

    if( !publicKey ){
      return { error: '无法获取公钥' }
    }

    while (true) {
      // 0 验证码
      if (needcaptcha && !formdata.verifyCode) {

        let resp = await this.fetch('/caiyun/aas/platform/tellin/verfycode.do', `<root><account>${username}</account><type>0</type></root>`, {
          encoding: null,
          json:false
        })
        let imgBase64
        if (resp.body) {
          imgBase64 = "data:" + resp.headers["content-type"] + ";base64," + Buffer.from(resp.body).toString('base64');
        }
        if (retry <= 0) {
          let key = captchaId || Math.random()
          this.captchaProcess[key] = { username, password }
          return { error: true, body: { key, img: imgBase64 } }
        }
        retry--
      }

      delete this.captchaProcess[captchaId]

      // 1 登陆
      let key = getRandomSring(16)
      let body = {
        autoLogin: true,
        clientId: "0010101",
        encryptMsg: aesEncrypt(JSON.stringify(formdata), key)
      }
      let resp = await this.fetch('/caiyun/openapi/authentication/login', body, {
        skey:rsaEncrypt(key,publicKey)
      })
      if (resp && resp.body && resp.body.statusCode == 200) {
        let code = resp.body.mcsCode
    
        if( code == '0' ){
          let cookie = resp.headers['set-cookie'].join('; ')
          let client = { username, password, cookie, updated_at: Date.now() }
          if (this.clientMap[username]) {
            client.path = this.clientMap[username].path
          }
          this.clientMap[username] = client
          await this.updateDrives(this.stringify({ username, password, path: client.path, cookie }))

          if( path ){
            let realPath = await this.searchRootId(username,path)
            if( realPath ){
              client.path = realPath
              await this.updateDrives(this.stringify({ username, password, path: client.path, cookie }))
            }
          }

          error = false
          break;
        }
        // 200050401 The user information is incorrect. 密码不正确
        // 200059521 密码不正确（需验证码）
        // ["9103", "账号或密码不正确，请重新输入"], ["9441", "账号或密码不正确，请重新输入"], ["9999
        else if( code == '200050401' || code == '200059521' || ['9103','9441','9999'].includes(code)){
          return { error: resp.body.message + '<br/>账号密码不正确' }
        }
        //Too many login failures. Graphic verification code is required.
        else if (code == '200059504') {
          needcaptcha = true
          continue
        }
        //验证码错误 The verification code is incorrect.
        else if (code == '200059512') {
          needcaptcha = true
          formdata.verifyCode = null
          continue
        } else {
          return { error : resp.body.message }
        }
      }
    }

    return { error }
  }

  async update(id) {
    if (!id.startsWith(protocol)) {
      id = protocol + ':' + id
    }
    let data = this.parse(id)
    if (data.username) {
      let hit = this.clientMap[data.username]
      if (hit) {
        return await this.create(hit.username, hit.password)
      }
    }
  }

  async afterPrepare(data = {}, id, req) {
    let { error, body } = data
    if (!error) {
      return { id, type: 'folder', protocol: protocol, redirect: req.origin + req.path }
    } else {
      if (body) {
        return { id, type: 'folder', protocol: protocol, body: await this.captchaPage({ username: data.username, password: data.password, ...body }) }
      } else {
        return { id, type: 'folder', protocol: protocol, body: await this.install(error || '请确认账号密码') }
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

    const req = this.helper.getRuntime()

    let baseUrl = req.origin + req.path

    //验证码
    if (req.body && req.body.key && req.body.captcha && this.hasCaptchaTask(req.body.key)) {
      return await this.afterPrepare(await this.resumeCaptchaTask(req.body.key, req.body.captcha), id, req)
    }

    let { path, cookie, username, password, error, custom } = await this.get(id)
    if (cookie) {
      return { cookie, path, username }
    } else {
      if (req.body && req.body.username && req.body.password && req.body.act == 'install') {
        let { username, password, path, key, captcha } = req.body
        console.log('create',username, password, path, key)
        let data = await this.create(username, password, key, captcha,path)
        return await this.afterPrepare(data, id, req)
      } else if (custom) {
        return { id, type: 'folder', protocol: protocol, body: await this.captchaPage({ username, password, ...custom }) }
      }

      return { id, type: 'folder', protocol: protocol, body: await this.install(error) }
    }
  }
}


/**
 * 
 * 
 */
class CY {
  constructor(helper) {
    this.name = 'CaiYun'
    this.label = '和彩云 账号登录版'
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

  async init() {
    let drives = await this.helper.getDrives()
    this.manager.init(drives)
  }

  async fetch(url, body, id , retry_times = 3) {
    let timestamp = Date.now()
    let key = getRandomSring(16)
    let { cookie } = await this.manager.prepare(id)
    let headers = {
      'caller': 'web',
      'CMS-CLIENT': '0010101',
      'CMS-DEVICE': 'default',
      'CMS-SIGN': timestamp + "," + key + "," + getSign(undefined, body, timestamp, key),
      'x-DeviceInfo': '||9|85.0.4183.102|chrome|85.0.4183.102|||windows 10||zh-CN|||',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36',
      'Cookie':cookie,
      'Referer': 'https://c.139.com/w/'
    }

    let resp = { error: 'request error' }

    let options = {
      async: true,
      url: 'https://c.139.com' + url,
      method: 'POST',
      headers: headers,
      json: true,
      body,
    }

    let failCode = ["401", "1809111401", "200000401", "200000413", "1909011501"]

    try{
      resp = await this.helper.request(options)
    }catch(e){

    }

    if (resp && resp.body && resp.body.statusCode == 200) {
      let code = resp.body.mcsCode
      if (code == '0') {
        
      } 
      else if (failCode.includes(code)) {

        let { error } = await this.manager.update(id)

        if (error) {
          resp.error = error
        } else {
          resp = await this.fetch(url, body, id)
        }
      } else {
        resp = { error: resp.body.message }
      }
    }else{
      resp = { error: resp.body.message || 'unknow error' }
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
  async path(id, { folderDownload = false, folderName = '' } = {}) {
    let { manager, protocol, helper, max_age_dir } = this

    let data = await manager.prepare(id)

    if (!data.cookie) return data

    let { path, cookie, username } = data

    let r = helper.cache.get(id)

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
        // console.log(Date.now() + ' CACHE CaiYun ')
        return r
      }
    }

    let pathArgs = path.replace(/(^\/|\/$)/, '').split('/')

    let [folderId, fileId] = pathArgs

    if (!fileId) {
      let children = [],
        pageNum = 1
      while (true) {
        let resp = await this.fetch('/caiyun/openapi/storage/catalog/getDisk', {
          "catalogID": folderId,
          "sortDirection": 1,
          "startNumber": pageNum,
          "endNumber": 1000,
          "filterType": 0,
          "catalogSortType": 0,
          "contentSortType": 0
        }, id)

        if (resp.error) {
          return {
            id,
            type: 'folder',
            protocol: protocol,
            body: resp ? resp.error : 'Network Error'
          }
        }

        let content = resp.body.data
        if( content.catalogList){
          for(let file of content.catalogList.catalogInfo){
            children.push({
              id: manager.stringify({ username, path: `/${file.catalogID}`}),
              name: file.catalogName,
              protocol: protocol,
              created_at: datetimeFormat(file.uploadTime),
              updated_at: datetimeFormat(file.updateTime),
              type: 'folder',
            })
          }
        }
        if( content.contentList ){
          for(let file of content.contentList.contentInfo){
            let item = {
              id: manager.stringify({ username, path: `/${folderId}/${file.contentID}`}),
              name: file.contentName,
              protocol: protocol,
              created_at: datetimeFormat(file.uploadTime),
              updated_at: datetimeFormat(file.updateTime),
              type: 'file',
              ext:file.contentSuffix,
              size:file.contentSize,
              md5:file.digest,
            }
            if (file.bigthumbnailURL) item.icon = file.bigthumbnailURL
            children.push(item)  
          }
        }
        

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

      result.downloadable = path != '00019700101000000001'

      helper.cache.set(id, result)

      return result
    } else if (fileId) {
      let parentId = manager.stringify({ username, path: pathArgs.slice(0, -1).join('/') })

      let parentData = await this.path(parentId)

      let hit = parentData.children.find(i => i.id == id)

      if (!hit) return false

      let resp = await this.fetch('/caiyun/openapi/storage/download/downloadRequest', {
        "appName": "",
        "contentID": fileId
      }, id)
      if (resp.error) {
        return {
          id,
          type: 'folder',
          protocol: protocol,
          body: resp ? resp.error : 'Network Error'
        }
      }

      let expired_at = Date.now() + 50 * 1000
      let downloadUrl = resp.body.data

      resp = {
        id,
        url: downloadUrl,
        name: hit.name,
        ext: hit.ext,
        protocol: protocol,
        size: hit.size,
        $expired_at: expired_at,
        $cached_at: Date.now(),
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

  async downloadFolder(id, name) {
    let { manager, protocol, helper, max_age_dir } = this

    let data = await manager.prepare(id)

    if (!data.cookie) return data

    let { path, cookie } = data

    let pathArgs = path.replace(/(^\/|\/$)/, '').split('/')

    let [folderId] = pathArgs

    let resp = await this.fetch('/caiyun/openapi/storage/download/downloadZipPkgReq', {
      "catalogList": { "catalogBriefs": [{ "id": folderId }] },
      "contentList": { "contentInfos": [] },
      "zipFileName": name || folderId,
      "recursive": 1
    }, id)

    if (resp && resp.body && resp.body.data) {
      return resp.body.data
    } else {
      return false
    }

  }

  async createReadStream({ id, options = {} } = {}) {

  }

}


module.exports = CY