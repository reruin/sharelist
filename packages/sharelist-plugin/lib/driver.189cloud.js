/**
 * 189Cloud Drive By Cookies
 */
const protocol = 'ctc'

const DEFAULT_ROOT_ID = '-11'

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
    })

    if (resp.data && resp.data == '1') {
      return true
    } else {
      return false
    }
  }

  async getCaptcha(captchaToken, reqId, cookie) {
    let resp = await request(
      `https://open.e.189.cn/api/logbox/oauth2/picCaptcha.do?token=${captchaToken}&REQID=${reqId}&rnd=${Date.now()}`,
      {
        headers: {
          Cookie: cookie,
          Referer: 'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do',
        },
        contentType: 'buffer',
      },
    )

    if (resp.error) return { error: resp.error }

    let imgBase64 = (imgBase64 =
      'data:' + resp.headers['content-type'] + ';base64,' + Buffer.from(resp.data).toString('base64'))

    await this.app.ocr(imgBase64)
  }

  /**
   * refreshCookie
   *
   * @param {object} {account , password}
   * @return {object} { credentials | error }
   * @api private
   */
  async refreshCookie({ account, password }) {
    const { request } = this.app
    //0 准备工作： 获取必要数据
    let defaultHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
    }
    let { data, headers, error } = await request.get(
      'https://cloud.189.cn/api/portal/loginUrl.action?redirectURL=https://cloud.189.cn/web/redirect.html',
      {
        headers: { ...defaultHeaders },
        responseType: 'text',
      },
    )

    if (error) return { error }

    let captchaToken = (data.match(/name='captchaToken' value='(.*?)'>/) || ['', ''])[1],
      returnUrl = (data.match(/returnUrl = '(.*?)'\,/) || ['', ''])[1],
      paramId = (data.match(/var paramId = "(.*?)";/) || ['', ''])[1],
      lt = (data.match(/var lt = "(.*?)";/) || ['', ''])[1],
      reqId = (data.match(/reqId = "(.*?)";/) || ['', ''])[1]

    let cookie = headers['set-cookie']

    let formdata = {
      appKey: 'cloud',
      accountType: '01',
      userName: account,
      password: password,
      validateCode: '',
      captchaToken: captchaToken,
      returnUrl: returnUrl,
      mailSuffix: '@189.cn',
      dynamicCheck: 'FALSE',
      clientType: '10010',
      cb_SaveName: '1',
      isOauth2: 'false',
      state: '',
      paramId: paramId,
    }

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

        formdata.validateCode = code
      }

      // 登陆
      let { data, error } = await request.post('https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do', {
        headers: {
          Referer: 'https://cloud.189.cn/udb/udb_login.jsp?pageId=1&redirectURL=/main.action',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          REQID: reqId,
          lt: lt,
        },
        data: formdata,
      })

      if (error) return { error }
      console.log(data)
      //验证码错误
      if (data.result == -2) {
        console.log('validateCode:[' + formdata.validateCode + '] error')
        continue
      }

      if (!data.toUrl) return { error: { message: data.msg } }

      let { headers } = await request.get(data.toUrl, {
        followRedirect: false,
        headers: defaultHeaders,
        responseType: 'text',
      })

      //COOKIE_LOGIN_USER=xxxxx;
      let cookie = headers?.['set-cookie'].match(/COOKIE_LOGIN_USER=(?<token>[a-z\d]+)/i)?.groups.token

      if (!cookie) return { error: { message: 'login failed. Can not get cookies!' } }

      return {
        credentials: {
          account,
          password,
          cookie: `COOKIE_LOGIN_USER=${cookie};`,
          updated_at: Date.now(),
        },
      }
    }

    return { error: { message: `Login failed` } }
  }

  /**
   * get credentials by client_id
   *
   * @param {string} [id]
   * @return {object}
   * @api public
   */
  async getCredentials(key) {
    let credentials = this.clientMap[key]

    if (!credentials || !credentials.password || !credentials.account) {
      return { error: { message: 'unmounted' } }
    }

    if (!credentials.cookie) {
      let result = await this.refreshCookie(credentials)
      if (result.error) {
        return result
      } else {
        credentials = result.credentials
        this.clientMap[key] = { ...credentials }
        await this.app.saveDrive({ key, cookie: credentials.cookie })
      }
    }

    return { credentials }
  }

  async parse(id) {
    let { key, path } = this.app.decode(id)
    let { error, credentials } = await this.getCredentials(key)
    let ret = { key, path, error }
    if (!error) {
      ret.cookie = credentials.cookie
      ret.root_id = credentials.root_id
    }
    return ret
  }

  async safeRequest(url, options, check = true) {
    let { error, data, status, headers } = await this.app.request(url, options)

    if (error) return { error }

    // cookie is invalid
    if (data.errorCode === 'InvalidSessionKey' && check) {
      let key = Object.values(this.clientMap).find((i) => i.cookie === options.headers.cookie)?.account
      console.log('update cookie for', key)

      if (key) {
        this.clientMap[key].cookie = ''
        let { error } = await this.getCredentials(key)
        if (error) return { error }
        return await this.safeRequest(url, options, false)
      }
    }

    return { error, data, status, headers }
  }
}

module.exports = class Driver {
  constructor() {
    this.name = '189Cloud'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 7 * 24 * 60 * 60 * 1000 // 7 days

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

  async list(id, { sort, search }) {
    let { manager, app, max_age_dir } = this

    let { error, path, key, cookie, root_id } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#list`

    let r = app.cache.get(cacheId)

    if (r && !search) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let fid = path || root_id || DEFAULT_ROOT_ID

    let data = await this._list(fid, cookie, key)

    if (data.error) return data

    data.forEach((i) => {
      i.id = this.app.encode({ key, path: i.id })
    })

    let result = {
      id,
      files: data,
    }

    if (!search) app.cache.set(cacheId, result, max_age_dir)

    return result
  }

  async get(id) {
    let { manager, app } = this

    let { error, path, cookie } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#get`

    let r = app.cache.get(cacheId)

    if (r) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let fid = path

    let data = await this._get(fid, cookie)

    if (data.error) return data

    data.id = id

    let expired_at = data.download_url.match(/Expires=(?<expired_at>\d+)/)?.groups.expired_at

    if (expired_at) {
      expired_at = +expired_at * 1000
      app.cache.set(id, data, expired_at - Date.now() - 3000)
    }

    // console.log('data', data)
    return data
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
  async _list(id, cookie) {
    const {
      utils: { timestamp },
    } = this.app

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

      let { data, error } = await this.manager.safeRequest('https://cloud.189.cn/api/open/file/listFiles.action', {
        data: params,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          cookie: cookie,

          // default format is xml
          accept: 'application/json;charset=UTF-8',
        },
        responseType: 'text',
      })

      data = safeJSONParse(data)

      if (error) return { error }

      if (data?.errorCode) return { error: { message: data.errorMsg } }

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
  async _get(id, cookie) {
    let { data, error } = await this.manager.safeRequest(`https://cloud.189.cn/api/portal/getFileInfo.action`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
        cookie,
        // default format is xml
        accept: 'application/json;charset=UTF-8',
      },
      data: {
        noCache: Math.random(),
        fileId: id,
      },
    })
    // console.log(data)
    if (error) return { error }

    if (data.res_code != 0) return { error: { message: data.res_message } }

    let result = {
      id: data.fileId,
      name: data.fileName,
      type: data.isFolder ? 'folder' : 'file',
      size: data.fileSize,
      ctime: data.createTime,
      mtime: data.lastOpTime,
      download_url: data.isFolder ? '' : `https:${data.downloadUrl}`,
      extra: {
        fid: data.fileId,
        parent_id: data.parentId,
      },
    }

    if (data.imageInfo?.icon) {
      result.thumb = data.imageInfo.icon.smallUrl
    }

    if (result.download_url) {
      result.download_url = await this.get_real_download_url(cookie, result.download_url)
    }

    return result
  }

  async get_real_download_url(cookie, url) {
    let { headers } = await this.manager.safeRequest(url, {
      followRedirect: false,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        Cookie: cookie,
      },
      responseType: 'text',
    })

    if (headers?.location) {
      let { headers: headers2 } = await this.manager.safeRequest(headers.location, {
        followRedirect: false,
        responseType: 'text',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        },
      })
      return headers2?.location
    }
  }

  async createReadStream(id, options = {}) {
    let { error, path, account, token } = await manager.parse(id)

    if (error) return { error }

    const { request } = this.app

    let [fid] = path.split('@')

    let url = await this.get_download_url(account, token, fid)

    let headers = {}

    if ('start' in options) {
      headers['range'] = `bytes=${options.start}-${options.end || ''}`
    }

    let resp = await request.get(url, {
      headers,
      responseType: 'stream',
      retry: 0,
    })

    return resp.data
  }
}
