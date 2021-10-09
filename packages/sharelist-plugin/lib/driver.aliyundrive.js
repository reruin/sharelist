/**
 * Aliyun Drive
 *
 * aliyun://userId/?root_id&refresh_token
 * aliyun://userId/path
 */
const protocol = 'aliyun'

const UPLOAD_PART_SIZE = 10 * 1024 * 1024

const DEFAULT_ROOT_ID = 'root'

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

    for (let i of (await this.app.getDrives())) {
      let data = this.app.decode(i.path)
      let { key, refresh_token } = data
      let needUpdate = false

      //init drive_id and user_id
      if (!data.user_id) {
        let credentials
        try {
          credentials = await this.refreshAccessToken(data)
        } catch (e) {
          continue
        }

        data.key = data.user_id = key = credentials.user_id
        data.refresh_token = credentials.refresh_token
        needUpdate = true
      }

      //处理相同key的情形
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
        await this.app.saveDrive(data, { refresh_token })
      }
      this.clientMap[key] = data
    }
  }

  /**
   * refreshAccessToken
   *
   * @param {object} options
   * @param {string} options.refresh_token
   * @return {object} [credentials]
   * @api private
   */
  async refreshAccessToken({ refresh_token: lastRefeshToken, ...rest }) {
    //https://api.aliyundrive.com/token/refresh can't support mobile token
    let { data } = await this.app.request.post('https://api.aliyundrive.com/v2/account/token', {
      data: {
        refresh_token: lastRefeshToken,
        grant_type: "refresh_token"
      },
      headers: {
        'User-Agent': 'None',
      },
      contentType: 'json',
    })

    if (data && !data.access_token) {
      this.app.error({ message: data.message || 'An error occurred during refresh access token' })
    }

    let { user_id, access_token, default_drive_id: drive_id, expires_in, refresh_token } = data

    // expires_in 7200s
    let expires_at = Date.now() + expires_in * 1000

    return {
      ...rest,
      user_id,
      access_token,
      refresh_token,
      expires_at,
      drive_id,
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


    if (!(credentials.access_token && credentials.expires_at && credentials.expires_at - Date.now() > 5 * 60 * 1000)) {
      credentials = await this.refreshAccessToken(credentials)

      this.clientMap[key] = { ...credentials }
      await this.app.saveDrive({ key, refresh_token: credentials.refresh_token })
    }

    return credentials
  }

}

module.exports = class Driver {
  constructor() {
    this.name = 'Aliyun Drive'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 30 * 24 * 60 * 60 * 1000 // 7 days

    this.guide = [
      { key: 'refresh_token', label: 'Refresh Token', type: 'string', required: true },
      {
        key: 'root_id',
        label: '初始文件夹ID / Root ID',
        help: 'https://www.aliyundrive.com/drive/folder/xxxxxxxxxxx 地址中 xxxx 的部分',
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
   * list files
   *
   * @param {string} [id] folder id
   * @param {object} [options] list options
   * @param {object} [options.sort] sort methods
   * @param {object} [options.search] search
   * @param {object} [key] key
   * @return {object}
   *
   * @api public
   */
  async list(id, options, key) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let { drive_id, access_token } = await this.getCredentials(key)

    let marker,
      children = []

    do {
      let params = {
        drive_id,
        parent_file_id: id,
        limit: 200,
        fields: "*",
        url_expire_sec: 1600
      }

      if (marker) {
        params.marker = marker
      }

      let { data } = await request.post(`https://api.aliyundrive.com/adrive/v3/file/list`, {
        data: params,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          Authorization: access_token,
        },
        contentType: 'json',
      })

      // if (!data.items) return { error: { message: 'An error occurred when list folder' } }
      if (data.error) return data

      if (!data.items) return this.app.error({ message: data.message })

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
   * @param {string} [file_id] path id
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async get(file_id, key) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let { drive_id, access_token } = await this.getCredentials(key)

    let { data } = await request.post(`https://api.aliyundrive.com/v2/file/get`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        file_id,
      },
      contentType: 'json',
    })

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

    if (result.type == 'file') {
      if (!result.download_url) {
        let res = await this.get_download_url(file_id, key)
        result.download_url = res.url
      }
      //web refresh_token 的 oss地址要求 验证来源
      if (result.download_url?.includes('x-oss-additional-headers=referer')) {
        result.extra.proxy = {
          headers: {
            referer: 'https://www.aliyundrive.com/',
          },
        }
      }
      let expired_at = +(result.download_url.match(/x\-oss\-expires=(?<expired_at>\d+)/)?.groups.expired_at || 0)

      result.max_age = expired_at - Date.now()
    }

    return result
  }

  async get_path(file_id, key) {
    let { drive_id, access_token } = await this.getCredentials(key)
    const { request } = this.app

    try {
      let { data } = await request.post(`https://api.aliyundrive.com/adrive/v1/file/get_path`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        data: {
          drive_id,
          file_id,
        },
        contentType: 'json',
      })

      return data?.items || []
    } catch (e) {
    }
  }
  /**
   * get download url
   *
   * @param {string} [file_id] file id
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async get_download_url(file_id, key) {
    let { drive_id, access_token } = await this.getCredentials(key)
    const { request } = this.app

    try {
      let { data } = await request.post(`https://api.aliyundrive.com/v2/file/get_download_url`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        data: {
          drive_id,
          file_id,
        },
        contentType: 'json',
      })

      const ret = { url: data?.url, size: data.size, max_age: new Date(data.expiration).getTime() - Date.now() }
      if (data.url?.includes('x-oss-additional-headers=referer')) {
        ret.proxy = {
          headers: {
            referer: 'https://www.aliyundrive.com/',
          },
        }
      }
      return ret
    } catch (e) {
      return {}
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
    let { drive_id, access_token } = await this.getCredentials(key)

    let { data } = await this.app.request.post(`https://api.aliyundrive.com/adrive/v2/file/createWithFolders`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        parent_file_id,
        name,
        type: 'folder',
        check_name_mode,
      },
      contentType: 'json',
    })

    if (data.error) return data.error

    return {
      id: data.file_id,
      name,
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
    let { drive_id, access_token } = await this.getCredentials(key)

    let { data } = await this.app.request.post(`https://api.aliyundrive.com/v3/file/update`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        file_id,
        name,
        check_name_mode,
      },
      contentType: 'json',
    })

    if (data.code) {
      if (data.code === 'AlreadyExist.File') {
        return this.app.error({ code: 409 })
      } else {
        return this.app.error(data)
      }
    }

    return {
      id: data.file_id,
      name: data.name,
      parent_id: data.parent_file_id
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
    let { drive_id, access_token } = await this.getCredentials(key)

    let { data } = await this.app.request.post(`https://api.aliyundrive.com/v2/batch`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        "requests":
          [{ "body": { drive_id, file_id }, "headers": { "Content-Type": "application/json" }, "id": file_id, "method": "POST", "url": "/recyclebin/trash" }],
        "resource": "file"
      }
      ,
      contentType: 'json',
    })

    if (data.code) {
      return this.app.error(data)
    }

    return { id: file_id }
  }


  /**
   * mv file/folder
   *
   * @param {string} [file_id] folder id
   * @param {string} [target_id] folder id
   * @return {string | error}
   *
   * @api public
   */
  async mv(file_id, target_id, key) {
    let { drive_id, access_token } = await this.getCredentials(key)

    let { data } = await this.app.request.post(`https://api.aliyundrive.com/v3/batch`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        "requests":
          [
            {
              "body": { drive_id, file_id, to_drive_id: drive_id, to_parent_file_id: target_id },
              "headers": { "Content-Type": "application/json" },
              "id": file_id,
              "method": "POST",
              "url": "/file/move"
            }],
        "resource": "file"
      }
      ,
      contentType: 'json',
    })

    if (data.code) {
      return this.app.error(data)
    }

    return { id: file_id }
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

    let res = await this.beforeUpload(id, { name, size, ...rest }, key)

    let upload_urls = res.part_info_list.map(i => i.upload_url)

    let { file_id, upload_id, file_name, rapid_upload } = res

    if (!rapid_upload) {
      let passStream = app.createReadStream(stream, { highWaterMark: 2 * UPLOAD_PART_SIZE })

      for (let upload_url of upload_urls) {
        let chunk = await passStream.read(UPLOAD_PART_SIZE)
        let headers = {
          'Referer': 'https://www.aliyundrive.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
        }
        headers['Content-Length'] = chunk.length
        await app.request(upload_url, {
          method: 'put',
          data: chunk,
          contentType: 'buffer',
          responseType: 'text',
          headers
        })
      }

      await this.afterUpload(file_id, upload_id, key)
    }

    return { id: file_id, name: file_name }
  }

  async haveSameFile(parent_id, name, size, key) {
    try {
      let files = this.list(parent_id, {}, key)
      return files.find(i => i.name === name && i.size === size)
    } catch (e) {

    }
    return false
  }

  // extra = { sha1 }
  async beforeUpload(parent_file_id, { name, size, check_name_mode, ...extra } = { check_name_mode: 'auto_rename' }, key) {
    let { drive_id, access_token } = await this.getCredentials(key)

    const partList = new Array(Math.ceil(size / UPLOAD_PART_SIZE)).fill(0).map((i, idx) => ({ part_number: idx + 1 }))

    // 无法提供sha1校验
    /*
    if (!extra.sha1) {
      if (await this.haveSameFile(parent_file_id, name, size, { access_token, drive_id })) {
        return this.app.error({ code: 409 })
      }
    }
    */
    let { data } = await this.app.request.post(`https://api.aliyundrive.com/adrive/v2/file/createWithFolders`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        parent_file_id,
        name,
        size,
        type: "file",
        check_name_mode,
        "part_info_list": partList,
        ...extra
      },
      contentType: 'json',
    })

    if (data.code) {
      return this.app.error(data)
    }

    return data
  }

  async afterUpload(file_id, upload_id, key) {
    let { drive_id, access_token } = await this.getCredentials(key)

    const {
      request,
    } = this.app
    let { data } = await request.post(`https://api.aliyundrive.com/v2/file/complete`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        drive_id,
        upload_id,
        file_id
      },
      contentType: 'json',
    })

    if (data.code) {
      return this.app.error(data)
    }

    return data
  }

  async video_preview(id, key) {
    let { drive_id, access_token } = await this.getCredentials(key)

    const {
      request,
      utils: { videoQuality },
    } = this.app

    let data = []
    try {
      let res = await request.post(`https://api.aliyundrive.com/v2/file/get_video_preview_play_info`, {
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

      data = res.data
    } catch (e) {
    }

    return data.video_preview_play_info.live_transcoding_task_list
      .filter((i) => !!i.url)
      .map((i) => ({ size: videoQuality(i.template_id), type: 'video/mp4', quality: i.template_id, src: i.url }))
  }
}
