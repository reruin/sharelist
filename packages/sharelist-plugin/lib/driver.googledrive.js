/**
 * GoogleDrive
 */

const protocol = 'googledrive'

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
    this.SCOPES = ['https://www.googleapis.com/auth/drive']
    this.OAUTH2_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
    this.OAUTH2_TOKEN_URL = 'https://oauth2.googleapis.com/token'
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
      // redirect_uri,
      refresh_token,
      grant_type: 'refresh_token',
    }

    let { data, error } = await this.app.request.post(this.OAUTH2_TOKEN_URL, { data: formdata })

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
        refresh_token, // refresh_token 永久有效
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
        // refresh_token 永久有效 不需要更新
        // await this.app.saveDrive({ key, refresh_token: credentials.refresh_token })
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

/**
 *
 *
 */
class Driver {
  constructor() {
    this.name = 'GoogleDrive'
    this.label = 'Google Drive'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 7 * 24 * 60 * 60 * 1000 // 7 days

    this.guide = [
      { key: 'client_id', label: '应用ID / Client ID', type: 'string', required: true },
      { key: 'client_secret', label: '应用机密 / Client Secret', type: 'string', required: true },
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
   * @param {string} [id] folder id
   * @param {object} [options] list options
   * @param {object} [options.sort] sort methods
   * @param {object} [options.search] search key
   * @return {object | error}
   *
   * @api public
   */
  async list(id, { sort, search }) {
    let { manager, app, max_age_dir } = this

    let { error, path, key, access_token } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#list`

    let r = app.cache.get(cacheId)

    if (r && !search) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let data = await this._list(access_token, { id: path, search })

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

  /**
   * get file details
   *
   * @param {string} [id] onedrive://{key}/{id}?query
   * @return {object} { id, files } | error
   * @api public
   *
   */
  async get(id) {
    let { manager, app, max_age_dir } = this

    let { error, path, access_token } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#get`

    let r = app.cache.get(cacheId)

    if (r) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }
    let data = await this._get(access_token, { id: path })

    if (data.error) return data

    data.id = id

    return app.cache.set(cacheId, data, max_age_dir)
  }

  //docs: https://developers.google.com/drive/api/v3/reference/files/list
  async _list(access_token, { id, search }) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    const url = 'https://www.googleapis.com/drive/v3/files'

    const q = ['trashed = false', `'${id || 'root'}' in parents`]

    if (search) {
      q.push(`name contains '${search}'`)
    }

    const params = {
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 1000,
      fields: `nextPageToken, files(id,name,mimeType,parents,size,fileExtension,thumbnailLink,modifiedTime,ownedByMe,contentHints,md5Checksum)`,
      q: q.join(' and '),
    }

    let pageToken,
      children = []

    do {
      let { data, error } = await request.get(url, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        data: { ...params, ...(pageToken ? { pageToken } : {}) },
      })

      if (error) return { error }

      if (data.error) return { error: { message: data.error.message } }

      pageToken = data.nextPageToken

      //nextPageToken
      data.files.forEach((i) => {
        let item = {
          id: i.id,
          name: i.name,
          type: i.mimeType.includes('.folder') ? 'folder' : 'file',
          size: parseInt(i.size),
          ctime: timestamp(i.createdTime),
          mtime: timestamp(i.modifiedTime),
          thumb: data.thumbnailLink,
          extra: {
            fid: i.id,
            parent_id: i.parents?.[0],
            md5: i.md5Checksum,
          },
        }

        if (item.type == 'file') {
          // if (i.file.hashes) {
          //   item.extra.sha1 = i.file.hashes.sha1Hash
          // }
          item.extra.mime = i.mimeType
        } else if (i.folder) {
          // item.extra.child_count = i.folder.childCount
        }

        children.push(item)
      })
    } while (pageToken)

    return children
  }

  //docs: https://developers.google.com/drive/api/v3/reference/files/get
  async _get(access_token, { id }) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let url = `https://www.googleapis.com/drive/v3/files/${id}`
    let { data, error } = await request.get(url, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        // acknowledgeAbuse: true,
        fields: `*`,
      },
    })

    if (error) return error

    if (data.error) return { error: { message: data.error.message } }

    return {
      id: data.id,
      name: data.name,
      type: data.mimeType.includes('.folder') ? 'folder' : 'file',
      size: data.size,
      ctime: timestamp(data.createdDateTime),
      mtime: timestamp(data.lastModifiedDateTime),
      thumb: data.thumbnailLink,
      extra: {
        fid: data.id,
        parent_id: data.parents?.[0],
        md5: data.md5Checksum,
        content_link: data.webContentLink,
      },
    }
  }

  async mkdir() {}

  async rm() {}

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

    let resp = await request.get(url, {
      headers,
      responseType: 'stream',
      retry: 0,
    })

    return resp.data
  }

  async createWriteStream() {}
}

module.exports = Driver
