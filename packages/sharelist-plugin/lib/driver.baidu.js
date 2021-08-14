/**
 * Baidu NetDisk
 */

const protocol = 'baidu'

const API = 'https://pan.baidu.com/rest/2.0/xpan'

const ERR_CODE = {
  0: '请求成功',
  2: '参数错误',
  '-6': '身份验证失败, access_token 是否有效? 部分接口需要申请对应的网盘权限',
  '-7': '文件或目录无权访问',
  '-9': '文件或目录不存在',
  31034: '命中接口频控',
  42000: '访问过于频繁',
  42211: '图片详细信息查询失败',
  42212: '共享目录文件上传者信息查询失败',
  42213: '共享目录鉴权失败',
  42214: '文件基础信息查询失败',
}

/**
 * auth manager class
 */
class Manager {
  static getInstance(app) {
    if (!this.instance) {
      this.instance = new Manager(app)
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
      let { key, refresh_token } = data

      let needUpdate = false
      if (!key && data.client_id) {
        data.key = key = data.client_id
        needUpdate = true
      }

      //if client_id existed
      if (key) {
        let isUsedKey = this.clientMap[key]
        if (isUsedKey) {
          data.key = key = `${key}::${Date.now()}`
          needUpdate = true
        }
      }

      if (needUpdate) {
        await this.app.saveDrive(data, { refresh_token })
      }

      this.clientMap[key] = { ...data }
    }
  }

  /**
   * 刷新令牌 / refresh token
   *
   * @param {object} credentials
   * @param {object} { credentials: object } | { error:true, message:string }
   * @api private
   */
  async refreshAccessToken(credentials) {
    let { client_id, client_secret, redirect_uri, refresh_token, path } = credentials

    if (!(client_id && client_secret && refresh_token)) {
      return { error: { message: 'Invalid parameters: An error occurred during refresh access token' } }
    }

    let formdata = {
      client_id: client_id.split('::')[0],
      client_secret,
      redirect_uri,
      refresh_token,
      grant_type: 'refresh_token',
    }

    let { data, error } = await this.app.request.post(`http://openapi.baidu.com/oauth/2.0/token`, { data: formdata })

    if (error) return { error }

    if (data.error)
      return {
        error: { message: data.error_description || data.error },
      }

    let expires_at = data.expires_in * 1000 + Date.now()

    return {
      credentials: {
        client_id,
        client_secret,
        path,
        redirect_uri,
        refresh_token: data.refresh_token, // refresh_token 永久有效
        access_token: data.access_token,
        expires_at,
      },
    }
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
    if (!credentials) {
      return { error: { message: 'unmounted' } }
    }
    // 未初始化(access_token不存在)、即将过期 刷新token
    if (!credentials.access_token || (credentials.expires_at && credentials.expires_at - Date.now() < 5 * 60 * 1000)) {
      let result = await this.refreshAccessToken(credentials)
      if (result.error) {
        return result
      } else {
        credentials = result.credentials

        this.clientMap[key] = {
          ...credentials,
        }
        await this.app.saveDrive({
          key,
          expires_at: credentials.expires_at,
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token,
        })
      }
    }

    return { credentials }
  }

  async parse(id) {
    let { key, path } = this.app.decode(id)
    let { error, credentials } = await this.getCredentials(key)

    let ret = { key, path, error }
    if (!error) {
      ret.access_token = credentials.access_token
    }
    return ret
  }
}

module.exports = class Driver {
  constructor() {
    this.name = 'Baidu NetDisk'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 7 * 24 * 60 * 60 * 1000 // 7 days

    this.guide = [
      { key: 'client_id', label: '应用ID / AppKey', type: 'string', required: true },
      { key: 'client_secret', label: '应用机密 / SecretKey', type: 'string', required: true },
      { key: 'redirect_uri', label: '回调地址 / Redirect URI', required: true },
      { key: 'refresh_token', label: '刷新令牌 / Refresh Token', type: 'string', required: true },
      { key: 'root_id', label: '初始文件夹ID', help: '', type: 'string', required: false },
    ]

    this.abusiveFilesMap = {}
  }

  onReady(app) {
    this.app = app
    this.manager = Manager.getInstance(app)
  }

  /**
   * Lists or search files
   *
   * @param {string} [id] folder id  e.g. baidu://{key}/{id}?query
   * @param {object} [options] list options
   * @param {object} [options.sort] sort methods
   * @param {object} [options.search] search key
   * @return {object | error}
   *
   * @api public
   */
  async list(id, { sort, search } = {}) {
    let { manager, app, max_age_dir } = this

    let { error, path, key, access_token } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#list`

    let r = app.cache.get(cacheId)

    if (r && !search) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let data = await this._list(access_token, { path: '/' + path })

    if (data.error) return data

    data.forEach((i) => {
      i.id = this.app.encode({ key, path: i.extra.path })
    })

    let result = {
      id,
      files: data,
    }

    if (!search) app.cache.set(cacheId, result, max_age_dir)

    return result
  }

  async get(id) {
    let { manager, app, max_age_dir } = this

    let { error, key, path, access_token } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#get`

    let r = app.cache.get(cacheId)

    if (r) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let parentData = await this.list(this.app.encode({ key, path: path.split('/').slice(0, -1).join('/') }))

    if (parentData.error) return parentData

    let file = parentData.files.find((i) => i.id == id)

    if (!file) {
      return {
        error: { code: 404, message: 'not found' },
      }
    }
    let data = await this._get(access_token, { id: file.extra.fid })

    // 大于 50M 的文件 无法直接下载，必须代理
    if (data.size > 50 * 1024 * 1024) {
      data.extra.proxy = {
        headers: {
          'user-agent': 'pan.baidu.com',
          referer: 'https://pan.baidu.com/',
        },
      }
    }

    // 8 hrs
    return app.cache.set(cacheId, data, 8 * 3600 * 1000)
  }

  // doc: https://pan.baidu.com/union/document/basic#%E8%8E%B7%E5%8F%96%E6%96%87%E4%BB%B6%E5%88%97%E8%A1%A8
  async _list(access_token, { path, search }) {
    const { request } = this.app

    const params = {
      method: 'list',
      access_token,
      dir: path,
      limit: 10000,
      web: 'web',
    }

    let start = 0,
      children = []
    do {
      let { data, error } = await request(`${API}/file`, {
        data: { ...params, start },
        contentType: 'json',
      })

      if (error) return { error }

      if (data.errno) return { error: { message: ERR_CODE[data.errno] } }

      data.list.forEach((i) => {
        let item = {
          id: i.fs_id,
          name: i.server_filename,
          type: i.isdir ? 'folder' : 'file',
          size: parseInt(i.size),
          ctime: i.server_ctime * 1000,
          mtime: i.server_mtime * 1000,
          thumb: i.thumbs ? i.thumbs.url2 : '',
          extra: {
            fid: i.fs_id,
            path: i.path.substring(1),
            md5: i.md5,
          },
        }

        children.push(item)
      })

      if (params.limit <= data.list.length) {
        start += params.limit
      } else {
        break
      }
    } while (true)

    return children
  }

  async _get(access_token, { id }) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let { data, error } = await request(`${API}/multimedia`, {
      data: {
        method: 'filemetas',
        access_token,
        fsids: `[${id}]`,
        dlink: 1,
      },
    })

    if (error) return { error }

    if (data.errno) return { error: { message: ERR_CODE[data.errno] } }

    let file = data.list[0]

    let result = {
      id,
      name: file.server_filename,
      type: file.isdir ? 'folder' : 'file',
      size: parseInt(file.size),
      ctime: file.server_ctime * 1000,
      mtime: file.server_mtime * 1000,
      thumb: file.thumbs ? file.thumbs.url2 : '',
      extra: {
        fid: file.fs_id,
        path: file.path.substring(1),
        md5: file.md5,
      },
    }

    // file.dlink 8 小时有效
    let { headers } = await request(`${file.dlink}&access_token=${access_token}`, {
      followRedirect: false,
      headers: {
        'User-Agent': 'pan.baidu.com',
      },
    })

    if (headers.location) {
      result.download_url = headers.location
    }

    return result
  }

  async mkdir() { }

  async rm() { }

  async isAbusiveFile(url, access_token) {
    if (url in this.abusiveFilesMap) {
      return this.abusiveFilesMap[url]
    } else {
      const resp = await this.app.request({
        method: 'HEAD',
        url,
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      })

      this.abusiveFilesMap[url] = resp.status == 403

      return this.abusiveFilesMap[url]
    }
  }

  async createReadStream(id, options = {}) {
    let {
      manager,
      app: { request },
      max_age_dir,
    } = this

    let { error, path, access_token } = await manager.parse(id)

    if (error) return { error }

    let url = `https://www.googleapis.com/drive/v3/files/${path}?alt=media`

    if (await this.isAbusiveFile(url)) {
      url += '&acknowledgeAbuse=true'
    }

    let headers = {
      Authorization: `Bearer ${access_token}`,
    }

    if ('start' in options) {
      headers['range'] = `bytes=${options.start}-${options.end || ''}`
    }

    let resp = await request(url, {
      headers,
      responseType: 'stream',
      retry: 0,
    })

    return resp.data
  }

  async createWriteStream() { }
}
