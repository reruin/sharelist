/**
 * 189Cloud Drive By Cookies
 */

const protocol = 'ctc'

const DEFAULT_ROOT_ID = '-11'

const UPLOAD_PART_SIZE = 10 * 1024 * 1024

const crypto = require('crypto')

const NodeRSA = require('node-rsa')

const safeJSONParse = (data) =>
  JSON.parse(
    data.replace(/(?<=:\s*)(\d+)/g, ($0, $1) => {
      if (!Number.isSafeInteger(+$1)) {
        return `"${$1}"`
      } else {
        return $1
      }
    }),
  )

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

const hmac = (v, key) => {
  return crypto.createHmac('sha1', key).update(v).digest('hex')
}

const md5 = (v) => crypto.createHash('md5').update(v).digest('hex')

// const base64Hex = v => Buffer.from(v).toString('base64')

const aesEncrypt = (data, key, iv = "") => {
  let cipher = crypto.createCipheriv('aes-128-ecb', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted
}

const rsaEncrypt = (data, publicKey, charset = 'base64') => {
  publicKey = '-----BEGIN PUBLIC KEY-----\n' + publicKey + '\n-----END PUBLIC KEY-----'

  let key = new NodeRSA(publicKey, { encryptionScheme: 'pkcs1' })
  return key.encrypt(data, charset)
}

const uuid = (v) => {
  return v.replace(/[xy]/g, (e) => {
    var t = 16 * Math.random() | 0
      , i = "x" === e ? t : 3 & t | 8;
    return i.toString(16)
  })
}

const qs = d => Object.keys(d).map(i => `${i}=${encodeURI(d[i])}`).join('&')

const parseHeaders = v => {
  let ret = {}
  for (let pair of decodeURIComponent(v).split('&').map(i => i.split('='))) {
    ret[pair[0].toLowerCase()] = pair.slice(1).join('=')
  }
  return ret
}
/**
 * auth manager class
 */
class Manager {
  static getInstance(app, helper) {
    if (!this.instance) {
      this.instance = new Manager(app, helper)
    }
    this.instance.init()
    return this.instance
  }

  constructor(app) {
    this.app = app
  }

  async init() {
    this.clientMap = {}
    let d = await this.app.getDrives()
    for (let i of d) {
      let data = this.app.decode(i.path)

      let { key } = data
      let needUpdate = false

      if (!key && data.account) {
        data.key = key = data.account
        needUpdate = true
      }

      if (key) {
        let isUsedKey = this.clientMap[key]
        if (isUsedKey) {
          data.key = key = `${key}.${Date.now()}`
          needUpdate = true
        }
      }
      if (!data.path) {
        data.path = data.root_id || DEFAULT_ROOT_ID
        needUpdate = true
      }
      if (needUpdate) {
        await this.app.saveDrive(data, { account: data.account })
      }

      this.clientMap[key] = data
    }
  }

  async needCaptcha(data, cookie) {
    let resp = await this.app.request.post('https://open.e.189.cn/api/logbox/oauth2/needcaptcha.do', {
      data,
      headers: {
        cookie: cookie,
        referer: 'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do',
      },
      contentType: 'form',
      responseType: 'text'
    })

    if (resp?.data == '1') {
      return true
    } else {
      return false
    }
  }

  async getCaptcha(captchaToken, reqId, cookie) {
    let resp = await this.app.request(
      `https://open.e.189.cn/api/logbox/oauth2/picCaptcha.do?token=${captchaToken}&REQID=${reqId}&rnd=${Date.now()}`,
      {
        headers: {
          cookie,
          Referer: 'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do',
        },
        responseType: 'buffer',
      },
    )

    if (resp.error) return { error: resp.error }

    let imgBase64 =
      'data:' + resp.headers['content-type'] + ';base64,' + Buffer.from(resp.data).toString('base64')

    return await this.app.ocr(imgBase64)
  }

  async getSessionKey(cookie) {
    let { data: baseData } = await this.app.request(`https://cloud.189.cn/v2/getUserBriefInfo.action?noCache=${Math.random()}`, {
      headers: {
        cookie,
        // accept: 'application/json;charset=UTF-8'
      },
      responseType: 'json'
    })
    return baseData.sessionKey
  }

  /**
   * refreshCookie
   *
   * @param {object} {account , password}
   * @return {object} { credentials | error }
   * @api private
   */
  async refreshCookie({ account, password, cookie_login_user, ...rest }) {

    const { request } = this.app

    if (cookie_login_user) {
      const cookie = `COOKIE_LOGIN_USER=${cookie_login_user};`
      const sessionKey = await this.getSessionKey(cookie)

      return {
        ...rest,
        account,
        password,
        sessionKey,
        cookie,
        updated_at: Date.now(),
      }
    }

    //0 准备工作： 获取必要数据
    let defaultHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
    }
    let { data, headers } = await request.get(
      'https://cloud.189.cn/api/portal/loginUrl.action?redirectURL=https://cloud.189.cn/web/redirect.html',
      {
        headers: { ...defaultHeaders },
        responseType: 'text',
      },
    )

    let { data: data2 } = await request.post(`https://open.e.189.cn/api/logbox/config/encryptConf.do`, {
      data: {
        appId: 'cloud'
      }
    })
    let { pubKey, pre, upSmsOn } = data2.data

    let captchaToken = (data.match(/name='captchaToken' value='(.*?)'>/) || ['', ''])[1],
      returnUrl = (data.match(/returnUrl = '(.*?)'\,/) || ['', ''])[1],
      paramId = (data.match(/var paramId = "(.*?)";/) || ['', ''])[1],
      lt = (data.match(/var lt = "(.*?)";/) || ['', ''])[1],
      reqId = (data.match(/reqId = "(.*?)";/) || ['', ''])[1]

    // console.log(headers, pubKey)
    let cookie = headers['set-cookie']

    let formdata = {
      appKey: 'cloud',
      accountType: '01',
      userName: `${pre}${rsaEncrypt(account, pubKey)}`,
      password: `${pre}${rsaEncrypt(password, pubKey)}`,
      userName: account,
      password: password,
      validateCode: '',
      captchaToken: captchaToken,
      returnUrl: returnUrl,
      mailSuffix: '@189.cn',
      dynamicCheck: 'FALSE',
      clientType: '1',
      cb_SaveName: '1',
      isOauth2: 'false',
      state: '',
      paramId: paramId,
    }
    // console.log(pubKey, pre, formdata)
    // return this.app.error({ message: 'haha' })
    let retry = 3
    let needcaptcha = await this.needCaptcha(
      {
        accountType: '01',
        userName: account,
        appKey: 'cloud',
      },
      cookie,
    )

    while (retry--) {
      // 验证码
      if (needcaptcha) {
        let { error, code } = await this.getCaptcha(captchaToken, reqId, cookie)

        if (error) return { error }

        code = code.replace(/\n/g, '')
        if (code.length == 4) {
          formdata.validateCode = code
          console.log('get code', code)
        } else {
          continue
        }

      }

      // 登陆
      let { data } = await request.post('https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do', {
        headers: {
          Referer: 'https://open.e.189.cn/api/logbox/oauth2/unifyAccountLogin.do',
          REQID: reqId,
          lt: lt,
        },
        data: formdata,
        contentType: 'form',
        responseType: 'json'
      })

      //验证码错误
      if (data.result == -2) {
        console.log('validateCode:[' + formdata.validateCode + '] error')
        continue
      }

      if (!data.toUrl) return this.app.error({ message: data.msg })

      let { headers } = await request.get(data.toUrl, {
        followRedirect: false,
        headers: defaultHeaders,
        responseType: 'text',
      })

      //COOKIE_LOGIN_USER=xxxxx;
      let loginUser = headers?.['set-cookie'].match(/COOKIE_LOGIN_USER=(?<token>[a-z\d]+)/i)?.groups.token

      if (!loginUser) return this.app.error({ message: 'login failed. Can not get cookies!' })

      const loginCookie = `COOKIE_LOGIN_USER=${loginUser};`
      const sessionKey = await this.getSessionKey(loginCookie)

      return {
        ...rest,
        account,
        password,
        sessionKey,
        cookie: loginCookie,
        updated_at: Date.now(),
      }
    }

    return this.app.error({ message: `Login failed` })
  }

  /**
   * get credentials by client_id
   *
   * @param {string} [id]
   * @return {object}
   * @api public
   */
  async getCredentials(key, force = false) {
    let credentials = this.clientMap[key]

    if (!credentials || !credentials.password || !credentials.account) {
      return { error: { message: 'unmounted' } }
    }

    if (!credentials.cookie || force) {
      credentials = await this.refreshCookie(credentials)
      this.clientMap[key] = { ...credentials }
      await this.app.saveDrive({ key, cookie: credentials.cookie, sessionKey: credentials.sessionKey })
    }

    return credentials
  }

  async safeRequest(url, options, retry = 3) {
    let { data, status, headers } = await this.app.request(url, options)

    if (retry > 0 && JSON.stringify(data).includes('InvalidSessionKey')) {
      let key = Object.values(this.clientMap).find((i) => i.cookie === options.headers.cookie)?.account

      if (key) {
        let credentials = await this.getCredentials(key, true)
        options.headers.cookie = credentials.cookie
        return await this.safeRequest(url, options, --retry)
      }
    }

    return { data, status, headers }
  }
}

module.exports = class Driver {
  constructor() {
    this.name = '189Cloud'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 30 * 24 * 60 * 60 * 1000 // 7 days

    this.guide = [
      {
        key: 'type',
        label: '类型 / Type',
        type: 'string',
        required: true,
        options: [
          { value: '1', label: '个人版' },
          // { value: '2', label: '家庭版' },
          // { value: '3', label: '企业版' }
        ],
      },
      { key: 'account', label: '手机号 / Account', type: 'string', required: true },
      { key: 'password', label: '密码 / Password', type: 'string', required: true },
      { key: 'cookie_login_user', label: 'COOKIE_LOGIN_USER', type: 'string', required: false, help: 'Cookies 中的COOKIE_LOGIN_USER字段，若提供此项则优先使用Cookies登录。' },
      {
        key: 'root_id',
        label: '初始文件夹ID / Root Id',
        help: 'https://cloud.189.cn/web/main/file/folder/xxxx 地址中 xxxx 的部分',
        type: 'string',
      },
    ]
  }

  onReady(app) {
    this.app = app
    this.manager = Manager.getInstance(app)
  }
  async getCredentials(key) {
    return await this.manager.getCredentials(key)
  }

  /**
   * list children
   *
   * @param {string} [access_token] access_token
   * @param {string} [id] folder id
   * @param {string} [drive_id] drive id
   * @return {array | error}
   *
   * @api public
   */
  async list(id, options, key) {
    const {
      utils: { timestamp },
    } = this.app

    let { cookie } = await this.getCredentials(key)

    let pageNum = 1,
      children = []

    do {
      let params = {
        folderId: id,
        inGroupSpace: false,
        mediaType: 0,
        iconOption: 5,
        descending: true,
        orderBy: 'lastOpTime',
        pageNum,
        pageSize: 1000,
        noCache: Math.random(),
      }
      let { data } = await this.manager.safeRequest('https://cloud.189.cn/api/open/file/listFiles.action', {
        data: params,
        headers: {
          cookie,
          // default format is xml
          accept: 'application/json;charset=UTF-8',
          // 'sign-type': 1,
        },
        responseType: 'text',
      })

      data = safeJSONParse(data)

      if (data?.errorCode) return this.app.error({ message: data.errorMsg })

      if (data.fileListAO?.folderList) {
        for (let i of data.fileListAO.folderList) {
          children.push({
            id: i.id,
            name: i.name,
            type: 'folder',
            size: i.size,
            ctime: timestamp(i.createDate),
            mtime: timestamp(i.lastOpTime),
            extra: {
              fid: i.id,
              parent_id: i.parentId,
              count: i.fileCount,
            },
          })
        }
      }

      if (data.fileListAO?.fileList) {
        for (let i of data.fileListAO.fileList) {
          children.push({
            id: i.id,
            name: i.name,
            type: 'file',
            size: i.size,
            ctime: timestamp(i.createDate),
            mtime: timestamp(i.lastOpTime),
            extra: {
              fid: i.id,
              parent_id: id,
              md5: i.md5,
            },
          })
        }
      }

      if (params.pageNum * params.pageSize < parseInt(data.recordCount)) {
        pageNum++
      } else {
        break
      }
    } while (true)

    return children
  }

  /**
   * get file
   *
   * @param {string} [id] path id
   * @return {object}
   *
   * @api public
   */
  async get(id, key, skipDownloadUrl = false) {
    let { cookie } = await this.getCredentials(key)

    let { data } = await this.manager.safeRequest(`https://cloud.189.cn/api/portal/getFileInfo.action`, {
      headers: {
        cookie,
        // default format is xml
        accept: 'application/json;charset=UTF-8',
      },
      data: {
        noCache: Math.random(),
        fileId: id,
      },
    })
    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    let result = {
      id: data.fileId,
      name: data.fileName,
      type: data.isFolder ? 'folder' : 'file',
      size: data.fileSize,
      ctime: data.createTime,
      mtime: data.lastOpTime,
      // download_url: data.isFolder ? '' : `https:${data.downloadUrl}`,
      extra: {
        fid: data.fileId,
        parent_id: data.parentId,
      },
    }

    if (data.imageInfo?.icon) {
      result.thumb = data.imageInfo.icon.smallUrl
    }

    if (!skipDownloadUrl && !result.download_url) {
      let { url, max_age } = await this.get_download_url(id, key)
      if (url) {
        result.download_url = url
        result.max_age = max_age
      }
    }
    return result
  }

  async get_download_url(id, key) {
    let { cookie } = await this.getCredentials(key)
    let { data } = await this.manager.safeRequest('https://cloud.189.cn/api/open/file/getFileDownloadUrl.action', {
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      data: {
        noCache: Math.random(),
        fileId: id,
      },
    })

    let download_url

    if (data.res_code != 0) return this.app.error({ message: data.res_message })
    if (data?.fileDownloadUrl) {
      let { headers } = await this.manager.safeRequest(data.fileDownloadUrl, {
        followRedirect: false,
        responseType: 'text',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        },
      })
      download_url = headers?.location
    }

    if (download_url) {
      let expired_at = download_url.match(/Expires=(?<expired_at>\d+)/i)?.groups.expired_at || 0
      let max_age = 0
      if (expired_at) {
        max_age = +expired_at * 1000 - Date.now()
      }
      return { url: download_url, max_age }
    }

    return { error: {} }
  }

  async mkdir(id, name, { check_name_mode = 'refuse' }, key) {
    let { cookie } = await this.getCredentials(key)
    let { data } = await this.manager.safeRequest(`https://cloud.189.cn/api/open/file/createFolder.action?noCache=${Math.random()}`, {
      method: 'POST',
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      contentType: 'form',
      data: {
        folderName: name,
        parentFolderId: id,
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    return {
      id: data.id,
      name: data.name,
      parent_id: id
    }
  }

  async rm(id, key) {
    let originData = await this.get(id, key, true)
    let { cookie } = await this.getCredentials(key)
    let { data } = await this.manager.safeRequest(`https://cloud.189.cn/api/open/batch/createBatchTask.action?noCache=${Math.random()}`, {
      method: 'POST',
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      contentType: 'form',
      data: {
        type: 'DELETE',
        taskInfos: [{ "fileId": id, "fileName": originData.name, "isFolder": originData.type == 'folder' ? 1 : 0 }],
        targetFolderId: ''
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    let taskId = data.taskId

    await this.waitTask({ taskId, type: 'DELETE' }, key)

    return {
      id: data.id,
      name: data.name,
      parent_id: originData.extra.parent_id
    }
  }

  async mv(id, target_id, key) {
    let originData = await this.get(id, key, true)

    let { cookie } = await this.getCredentials(key)
    let { data } = await this.manager.safeRequest(`https://cloud.189.cn/api/open/batch/createBatchTask.action?noCache=${Math.random()}`, {
      method: 'POST',
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      contentType: 'form',
      data: {
        type: 'MOVE',
        taskInfos: [{ "fileId": id, "fileName": originData.name, "isFolder": originData.type == 'folder' ? 1 : 0 }],
        targetFolderId: target_id
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    let taskId = data.taskId

    await this.waitTask({ taskId, type: 'MOVE' })

    return {
      id: originData.id,
      name: originData.name,
      parent_id: originData.extra.parent_id
    }
  }

  async copy(id, target_id, key) {
    let originData = await this.get(id, key, true)

    let { cookie } = await this.getCredentials(key)
    let { data } = await this.manager.safeRequest(`https://cloud.189.cn/api/open/batch/createBatchTask.action?noCache=${Math.random()}`, {
      method: 'POST',
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      contentType: 'form',
      data: {
        type: 'COPY',
        taskInfos: [{ "fileId": id, "fileName": originData.name, "isFolder": originData.type == 'folder' ? 1 : 0 }],
        targetFolderId: target_id
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    let taskId = data.taskId

    await this.waitTask({ taskId, type: 'MOVE' })

    return {
      id: originData.id,
      name: originData.name,
      parent_id: originData.extra.parent_id
    }
  }

  /**
   * rename file/folder
   *
   * @param {string} [id] folder id
   * @param {string} [name] new name
   * @return {object}
   *
   * @api public
   */
  async rename(id, name, { check_name_mode = 'refuse' } = {}, key) {
    let { cookie } = await this.getCredentials(key)
    let { data } = await this.manager.safeRequest(`https://cloud.189.cn/api/open/file/renameFolder.action?noCache=${Math.random()}`, {
      method: 'POST',
      headers: {
        cookie,
        accept: 'application/json;charset=UTF-8',
      },
      contentType: 'form',
      data: {
        destFolderName: name,
        folderId: id,
      },
    })

    if (data.res_code != 0) return this.app.error({ message: data.res_message })

    return {
      id: data.id,
      name: data.name,
      parent_id: data.parentId
    }
  }

  async generate_rsa_key(key) {
    if (!this.rsa_key || (this.rsa_key.expire - Date.now() < 5 * 60 * 1000)) {
      let { cookie } = await this.getCredentials(key)
      let { data } = await this.manager.safeRequest(`https://cloud.189.cn/api/security/generateRsaKey.action?noCache=${Math.random()}`, {
        headers: {
          cookie,
          accept: 'application/json;charset=UTF-8',
        },
        responseType: 'json'
      })
      console.log('update rsa_key')
      this.rsa_key = data
    }

    return this.rsa_key
  }

  async createRequest(url, formData, key) {
    let { sessionKey } = await this.getCredentials(key)
    let { pkId, pubKey } = await this.generate_rsa_key(key)

    let date = Date.now()
    let pkey = uuid("xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx").slice(0, 16 + 16 * Math.random() | 0)
    let params = aesEncrypt(qs(formData), pkey.substring(0, 16))
    let signature = hmac(`SessionKey=${sessionKey}&Operate=GET&RequestURI=${url}&Date=${date}&params=${params}`, pkey)
    let encryptionText = rsaEncrypt(pkey, pubKey)

    const headers = {
      signature,
      sessionKey,
      encryptionText,
      pkId,
      'x-request-id': uuid('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'),
      'x-request-date': date,
      'origin': 'https://cloud.189.cn',
      'referer': 'https://cloud.189.cn/'
    }

    return await this.app.request(`https://upload.cloud.189.cn${url}?params=${params}`, { headers })
  }

  async singleUpload(id, { size, name, stream, ...rest }, key) {
    const { app } = this

    let passStream = app.createReadStream(stream, { highWaterMark: 2 * UPLOAD_PART_SIZE })

    let buffer = await passStream.read(UPLOAD_PART_SIZE)

    let md5hash = md5(buffer)

    let { data } = await this.createRequest('/person/initMultiUpload', {
      parentFolderId: id,
      fileName: name,
      fileSize: size,
      sliceSize: UPLOAD_PART_SIZE,
      sliceMd5: md5hash,
      fileMd5: md5hash
    }, key)

    if (!data?.code == 'SUCCESS') return this.app.error({ message: 'a error occurred before upload.' })

    let { uploadFileId, fileDataExists } = data.data

    if (fileDataExists == 0) {

      // Skip step
      // let { data: d1, status } = await this.createRequest("/person/getUploadedPartsInfo", {
      //   uploadFileId
      // }, key)

      let chunk_base64 = Buffer.from(md5hash, 'hex').toString('base64')
      let { data: uploadData } = await this.createRequest('/person/getMultiUploadUrls', {
        uploadFileId,
        partInfo: `1-${chunk_base64}`,
      }, key)

      uploadData = uploadData?.['uploadUrls'][`partNumber_1`]

      let res = await app.request(uploadData.requestURL, {
        method: 'put',
        data: buffer,
        contentType: 'buffer',
        responseType: 'text',
        headers: {
          ...parseHeaders(uploadData.requestHeader),
          "referer": 'https://cloud.189.cn/',
        }
      })

      if (res.status != 200) app.error({ message: 'a error occurred during upload.' })
    }
    let { data: res } = await this.createRequest('/person/commitMultiUploadFile', {
      uploadFileId,
      fileMd5: md5hash,
      //fileSize<=10MB,fileMD5 should equal sliceMd5,
      sliceMd5: md5hash,
      lazyCheck: 0,
    }, key)

    return { id: res.file.userFileId }
  }

  async fastUpload(id, { size, name, md5 }, key) {
    if (md5) {

    }
  }

  async upload(id, { size, name, stream, ...rest }, key) {
    if (size <= UPLOAD_PART_SIZE) {
      return await this.singleUpload(id, { size, name, stream, ...rest }, key)
    }

    const { app } = this

    let { data } = await this.createRequest('/person/initMultiUpload', {
      parentFolderId: id,
      fileName: name,
      fileSize: size,
      sliceSize: UPLOAD_PART_SIZE,
      lazyCheck: 1
    }, key)

    if (!data?.code == 'SUCCESS') return this.app.error({ message: 'a error occurred before upload.' })

    let { uploadFileId } = data.data

    // 此操作疑似无实际效果
    // await this.createRequest('/person/getUploadedPartsInfo', {
    //   uploadFileId,
    // }, key)

    let part = Math.ceil(size / UPLOAD_PART_SIZE)
    let passStream = app.createReadStream(stream, { highWaterMark: 2 * UPLOAD_PART_SIZE })
    let md5chunk = []
    let md5sum = crypto.createHash('md5')
    for (let i = 1; i <= part; i++) {
      let buffer = await passStream.read(UPLOAD_PART_SIZE)
      let chunk_hash = md5(buffer).toUpperCase()
      let chunk_base64 = Buffer.from(chunk_hash, 'hex').toString('base64')

      md5chunk.push(chunk_hash)
      md5sum.update(buffer)

      let { data } = await this.createRequest('/person/getMultiUploadUrls', {
        partInfo: `${i}-${chunk_base64}`,
        uploadFileId,
      }, key)

      let uploadData = data['uploadUrls'][`partNumber_${i}`]

      let res = await app.request(uploadData.requestURL, {
        method: 'put',
        data: buffer,
        contentType: 'buffer',
        responseType: 'text',
        headers: parseHeaders(uploadData.requestHeader)
      })
      console.log(res)
      if (res.status != 200) app.error({ message: 'a error occurred during upload.' })
    }

    let uniqueIdentifier = md5sum.digest('hex')

    // commit
    let { data: res } = await this.createRequest('/person/commitMultiUploadFile', {
      uploadFileId,
      fileMd5: uniqueIdentifier,
      //fileSize<=10MB,fileMD5 should equal sliceMd5,
      sliceMd5: md5(md5chunk.join('\n')),
      lazyCheck: 1,
    }, key)
    return { id: res.file.userFileId }
  }

  async waitTask(params, key) {
    let { cookie } = await this.getCredentials(key)

    let retry = 3

    while (retry--) {
      let { data } = await this.manager.safeRequest(`https://cloud.189.cn/api/open/batch/checkBatchTask.action?noCache=${Math.random()}`, {
        method: 'POST',
        headers: {
          cookie,
          accept: 'application/json;charset=UTF-8',
        },
        contentType: 'form',
        data: params,
      })
      if (data?.taskStatus == 4) {
        return true
      }

      await sleep(200)
    }
  }
}
