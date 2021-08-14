/**
 * Aliyun Drive
 *
 * aliyun://userId/driveId/folderId/?password
 * aliyun://userId/driveId/folderId/fileId?password
 */

const protocol = 'aliyun'

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
      let { key, refresh_token } = data

      //初始化获取 drive_id 和 user_id
      if (!data.user_id) {
        let { credentials, err } = await this.refreshAccessToken(data)
        if (err) {
          continue
        }

        data.key = data.user_id = key = credentials.user_id

        await this.app.saveDrive(data, { refresh_token })
      }

      this.clientMap[key] = data
    }
  }

  /**
   * refreshAccessToken
   *
   * @param {object} {refresh_token , path}
   * @return {{ credentials }}
   * @api private
   */
  async refreshAccessToken({ refresh_token: lastRefeshToken, root_id }) {
    let { data, error } = await this.app.request.post('https://api.aliyundrive.com/token/refresh', {
      data: {
        refresh_token: lastRefeshToken,
      },
      headers: {
        'User-Agent': 'None',
      },
      contentType: 'json',
    })

    if (error) return { error }

    if (data && !data.access_token)
      return { error: { message: data.message || 'An error occurred during refresh access token' } }

    let { user_id, access_token, default_drive_id: drive_id, expires_in, refresh_token } = data

    let expires_at = Date.now() + expires_in * 1000

    return {
      credentials: {
        user_id,
        access_token,
        refresh_token,
        expires_at,
        drive_id,
        root_id,
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

    if (!credentials.access_token || (credentials.expires_at && credentials.expires_at - Date.now() < 5 * 60 * 1000)) {
      let result = await this.refreshAccessToken(credentials)
      if (result.error) {
        return result
      } else {
        credentials = result.credentials
        this.clientMap[key] = { ...credentials }
        await this.app.saveDrive({ key, refresh_token: credentials.refresh_token })
      }
    }

    return { credentials }
  }

  async parse(id) {
    let { key, path } = this.app.decode(id)
    let { error, credentials } = await this.getCredentials(key)

    let ret = { key, path, error }
    if (!error) {
      ret.drive_id = credentials.drive_id
      ret.access_token = credentials.access_token
      ret.root_id = credentials.root_id
    }
    return ret
  }
}

module.exports = class Driver {
  constructor() {
    this.name = 'Aliyun Drive'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 7 * 24 * 60 * 60 * 1000 // 7 days

    this.guide = [
      { key: 'refresh_token', label: 'Refresh Token', type: 'string', required: true },
      {
        key: 'root_id',
        label: '初始文件夹ID',
        help: 'https://www.aliyundrive.com/drive/folder/xxxxxxxxxxx 地址中 xxxx 的部分',
        type: 'string',
      },
    ]
  }

  onReady(app) {
    this.app = app
    this.manager = Manager.getInstance(app)
  }

  /**
   * list files
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

    let { error, path, key, access_token, drive_id, root_id } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#list`

    let r = app.cache.get(cacheId)

    if (r && !search) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let fid = path || root_id || 'root'

    let data = await this._list(access_token, fid, drive_id)

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
   * @param {string} [id] file id
   * @return {object | error}
   *
   * @api public
   */
  async get(id) {
    let { manager, app } = this

    let { error, path, access_token, drive_id, root_id } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#get`

    let r = app.cache.get(cacheId)

    if (r) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let fid = path.replace(/\//g, '') || root_id || 'root'

    let data = await this._get(access_token, fid, drive_id)

    if (data.error) return data

    data.id = id

    //TODO 某些token 的oss地址要求 验证来源
    if (data.download_url.includes('x-oss-additional-headers=referer')) {
      data.extra.proxy = {
        headers: {
          // 'referer': 'https://www.aliyundrive.com/',
          referer: 'https://www.aliyundrive.com/',
          // 'Referrer-Policy': 'no-referrer',
        },
      }
    }

    let expired_at = data.download_url.match(/x\-oss\-expires=(?<expired_at>\d+)/)?.groups.expired_at
    if (expired_at) {
      expired_at = +expired_at * 1000
      app.cache.set(id, data, expired_at - Date.now() - 3000)
    }

    return data
  }

  /**
   * list files
   *
   * @param {string} [access_token] access_token
   * @param {string} [id] folder id
   * @param {string} [drive_id] drive id
   * @return {array | error}
   *
   * @api private
   */
  async _list(access_token, id, drive_id) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let marker,
      children = []

    do {
      let params = {
        drive_id,
        parent_file_id: id,
        limit: 200,
      }

      if (marker) {
        params.marker = marker
      }

      let { data, error } = await request.post(`https://api.aliyundrive.com/v2/file/list`, {
        data: params,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          Authorization: access_token,
        },
        contentType: 'json',
      })

      if (error) return { error }

      // if (!data.items) return { error: { message: 'An error occurred when list folder' } }
      if (data.error) return data

      for (let i of data.items) {
        children.push({
          id: i.file_id,
          name: i.name,
          type: i.type == 'folder' ? 'folder' : 'file',
          size: i.size,
          ctime: timestamp(i.created_at),
          mtime: timestamp(i.updated_at),
          download_url: i.url,
          extra: {
            fid: i.file_id,
            parent_id: id,
          },
        })
      }

      marker = data.next_marker
    } while (marker)

    return children
  }

  /**
   * get file
   *
   * @param {string} [id] path id
   * @param {string} [id] folder id
   * @param {string} [drive_id] drive id
   * @return {object}
   *
   * @api private
   */
  async _get(access_token, id, drive_id) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let { data, error } = await request.post(`https://api.aliyundrive.com/v2/file/get`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        file_id: id,
      },
      contentType: 'json',
    })

    if (error) return { error }

    if (data.error) return data.error

    let result = {
      id: data.file_id,
      name: data.name,
      type: data.type,
      size: data.size,
      ctime: timestamp(data.created_at),
      mtime: timestamp(data.updated_at),
      download_url: data.download_url,
      extra: {
        fid: data.file_id,
        parent_id: data.parent_file_id,
      },
    }

    // if (data.category == 'video') {
    //   let sources = await this.video_preview(access_token, id, drive_id)
    //   result.extra.category = 'video'
    //   if (sources.length) {
    //     result.extra.sources = sources
    //   }
    // }

    return result
  }

  async video_preview(access_token, id, drive_id) {
    const {
      request,
      utils: { videoQuality },
    } = this.app

    let { data, error } = await request.post(`https://api.aliyundrive.com/v2/file/get_video_preview_play_info`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        category: 'live_transcoding',
        drive_id,
        file_id: id,
        template_id: '',
      },
      contentType: 'json',
    })
    if (error) return []
    return data.video_preview_play_info.live_transcoding_task_list
      .filter((i) => !!i.url)
      .map((i) => ({ size: videoQuality(i.template_id), type: 'video/mp4', quality: i.template_id, src: i.url }))
  }

  async createReadStream(id, options = {}) {
    let { key, path } = this.app.decode(id)

    let fid = path.replace(/\//g, '')

    let { error, credentials } = await manager.getCredentials(key)

    if (error) return { error }

    let { access_token, drive_id, root_id } = credentials

    await this.get(access_token, fid)

    // let { data , error } = await this.app.request({ url: resp.url, method: 'get', responseType: 'stream' })

    // return data
  }
}
