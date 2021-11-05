/**
 * GoogleDrive
 */

const protocol = 'googledrive'

const DEFAULT_ROOT_ID = 'root'

const UPLOAD_PART_SIZE = 5 * 1024 * 1024

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
      if (!data.path) {
        data.path = data.root_id || DEFAULT_ROOT_ID
        needUpdate = true
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
    let { client_id, client_secret, redirect_uri, refresh_token, ...rest } = credentials

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

    let { data } = await this.app.request.post(this.OAUTH2_TOKEN_URL, {
      data: formdata,
      contentType: 'json'
    })
    if (data.error) {
      this.app.error({ message: data.error_description || data.error })
    }

    let expires_at = data.expires_in * 1000 + Date.now()

    return {
      ...rest,
      client_id,
      client_secret,
      redirect_uri,
      refresh_token, // refresh_token 永久有效
      access_token: data.access_token,
      expires_at,
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
      return this.app.error({ message: 'unmounted' })
    }
    // 未初始化(access_token不存在)、即将过期 刷新token
    if (!(credentials.access_token && credentials.expires_at && credentials.expires_at - Date.now() > 5 * 60 * 1000)) {
      credentials = await this.refreshAccessToken(credentials)
      this.clientMap[key] = { ...credentials }
      // refresh_token 永久有效 不需要更新
    }

    return credentials
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

  async getCredentials(key) {
    return await this.manager.getCredentials(key)
  }

  //docs: https://developers.google.com/drive/api/v3/reference/files/list
  async list(id, options, key) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let { access_token } = await this.getCredentials(key)

    const url = 'https://www.googleapis.com/drive/v3/files'

    const q = ['trashed = false', `'${id}' in parents`]

    if (options.search) {
      q.push(`name contains '${options.search}'`)
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

      if (data.error) return this.app.error({ message: data.error.message })

      pageToken = data.nextPageToken

      //nextPageToken
      data.files.forEach((i) => {
        let item = {
          id: i.id,
          name: i.name,
          type: i.mimeType.includes('.folder') ? 'folder' : 'file',
          size: parseInt(i.size || 0),
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
  /**
   * get file
   *
   * @param {string} [file_id] path id
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async get(id, key) {
    let { access_token } = await this.getCredentials(key)

    const {
      request,
      utils: { timestamp },
    } = this.app

    let url = `https://www.googleapis.com/drive/v3/files/${id}`
    let { data } = await request.get(url, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        // acknowledgeAbuse: true,
        fields: `*`,
      },
    })

    if (data.error) return this.app.error({ message: data.error.message })

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


  /**
   * create folder
   *
   * @param {string} [id] folder id
   * @param {string} [name] folder name
   * @param {object} [options] options
   * @param {object} [options.check_name_mode] 
   * @return {object}
   *
   * @api public
   */
  async mkdir(parent_file_id, name, { check_name_mode = 'refuse' }, key) {
    let { access_token } = await this.getCredentials(key)

    let { data } = await this.app.request.post(`https://www.googleapis.com/drive/v3/files`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        'name': name,
        'parents': [parent_file_id],
        'mimeType': 'application/vnd.google-apps.folder',
      },
      contentType: 'json',
    })

    if (data.error) return this.app.error({ message: data.error.message })

    return {
      id: data.id,
      name: data.name,
      parent_id: parent_file_id
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
  async rename(file_id, name, { check_name_mode = 'refuse' } = {}, key) {
    let { access_token } = await this.getCredentials(key)

    let { data } = await this.app.request(`https://www.googleapis.com/drive/v3/files/${file_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        name,
      },
      contentType: 'json',
    })

    if (data.error) return this.app.error({ message: data.error.message })

    return {
      id: data.id,
      name: data.name,
    }
  }


  /**
   * mv file/folder
   *
   * @param {string} [file_id] folder id
   * @param {string} [parent_id] folder id
   * @return {string | error}
   *
   * @api public
   */
  async mv(file_id, parent_id, key) {
    let { access_token } = await this.getCredentials(key)
    let filedata = await this.get(file_id, key)

    let { data } = await this.app.request(`https://www.googleapis.com/drive/v3/files/${file_id}?addParents=${parent_id}&removeParents=root`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      contentType: 'json',
    })

    if (data.error) return this.app.error({ message: data.error.message })

    return {
      id: data.id,
      name: data.name,
      parent_id: filedata.extra.parent_id
    }
  }

  /**
   * remove file/folder
   *
   * @param {string} [id] folder id
   * @return {string}
   *
   * @api public
   */
  async rm(file_id, key) {
    let { access_token } = await this.getCredentials(key)
    let filedata = await this.get(file_id, key)

    let { status } = await this.app.request(`https://www.googleapis.com/drive/v3/files/${file_id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      responseType: 'text',
    })

    if (status != 204) {
      return this.app.error({ message: 'An error occurred during delete files' })
    }

    return {
      id: file_id,
      parent_id: filedata.extra.parent_id
    }
  }

  async beforeUpload(parent_id, { name }, key) {
    let { access_token } = await this.getCredentials(key)

    let { headers, status, data } = await this.app.request.post(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`, {
      data: {
        name,
        parents: [parent_id]
      },
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      contentType: 'json',
      responseType: 'text'
    })
    return headers?.location
  }

  /**
   * upload file
   *
   * @param {string} [id] folder id
   * @param {object} [options] upload file meta
   * @param {number} [options.size] upload file size
   * @param {string} [options.name] upload file name
   * @param {ReadableStream} [options.stream] upload file stream
   * @param {object} [credentials] credentials
   * @return {string | error}
   *
   * @api public
   */
  async upload(id, { size, name, stream, ...rest }, key) {
    const { app } = this

    let uploadUrl = await this.beforeUpload(id, { name, size, ...rest }, key)

    if (!uploadUrl) {
      return app.error('An error occurred during upload, miss upload url')
    }

    let { data } = await app.request(uploadUrl, {
      method: 'put',
      headers: {
        'Content-Length': size,
        'Content-Range': `bytes ${0}-${size - 1}/${size}`,
      },
      data: stream,
      contentType: 'stream',
    })

    return {
      id: data.id,
      name: data.name,
      parent_id: id
    }
  }

  async isAbusiveFile(url, access_token) {
    if (url in this.abusiveFilesMap) {
      return this.abusiveFilesMap[url]
    } else {
      const resp = await this.app.request(url, {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        responseType: 'text'
      })

      this.abusiveFilesMap[url] = resp.status == 403

      return this.abusiveFilesMap[url]
    }
  }

  async createReadStream(id, options = {}, key) {
    let {
      app: { request },
    } = this

    let { access_token } = await this.getCredentials(key)

    let url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`

    if (await this.isAbusiveFile(url, access_token)) {
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

}

module.exports = Driver
