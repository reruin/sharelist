/**
 * Caiyun
 */

const crypto = require('crypto')

const protocol = 'caiyun'

const DEFAULT_ROOT_ID = '00019700101000000001'

const md5 = (v) => {
  return crypto.createHash('md5').update(v).digest('hex')
}

const getRandomSring = (e) => {
  let n = ''
  for (let t = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', a = 0; a < e; a++) {
    let o = Math.floor(Math.random() * t.length)
    n += t.substring(o, o + 1)
  }
  return n
}

const getSign = (params, extra, timestamp, rndstring) => {
  function serialize(e) {
    var t = []
    for (var n in e)
      if (e[n] || 0 === e[n] || '0' === e[n] || !1 === e[n])
        if (e[n] instanceof Object && !(e[n] instanceof Array)) {
          if (e[n] !== {} && 0 !== Object.keys(e[n]).length) {
            var a = '{'.concat(serialize(e[n]), '}'),
              o = n + '=' + a
            t.push(o)
          }
        } else if (e[n] instanceof Array) {
          var r = e[n]
          if (0 !== r.length) {
            var s = ''
            for (var c in r)
              r[c] instanceof Object ? (s = ''.concat(s, '{').concat(serialize(r[c]), '}')) : (s += r[c]),
                c < r.length - 1 && (s += ',')
            t.push(n + '=' + s)
          }
        } else {
          if ('string' === typeof e[n] && '' === e[n].trim()) continue
          t.push(n + '=' + e[n])
        }
    return 0 !== t.length ? ((t = t.sort()), t.join('&')) : ''
  }

  let key = serialize(Object.assign({}, extra, params))
  key += (key ? '&' : '') + 'key=' + md5(timestamp + ':' + rndstring)

  return md5(key).toUpperCase()
}

const datetimeFormat = (d) =>
  d ? d.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6+08:00') : ''

const createHeaders = (body) => {
  let timestamp = Date.now()
  let key = getRandomSring(16)
  let headers = {
    caller: 'web',
    'CMS-CLIENT': '0010101',
    'CMS-DEVICE': 'default',
    'CMS-SIGN': timestamp + ',' + key + ',' + getSign(undefined, body, timestamp, key),
    'x-DeviceInfo': '||9|92.0.4515.107|chrome|92.0.4515.107|||windows 10||zh-CN|||',
    Referer: 'https://yun.139.com/w/',
  }

  return headers
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

      //由于使用key作为 处理相同的 client_id，大部分情况
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

  /**
   * get credentials by client_id
   *
   * @param {string} [id]
   * @return {object}
   * @api public
   */
  async getCredentials(key) {
    let credentials = this.clientMap[key]

    if (!credentials || !credentials.token || !credentials.account) {
      return { error: { message: 'unmounted' } }
    }

    return { credentials }
  }

  async parse(id) {
    let { key, path } = this.app.decode(id)
    let { error, credentials } = await this.getCredentials(key)

    let ret = { key, path, error }
    if (!error) {
      ret.token = credentials.token
      ret.account = credentials.account
      ret.root_id = credentials.root_id
    }
    return ret
  }
}

module.exports = class Driver {
  constructor() {
    this.name = 'CaiYun'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 7 * 24 * 60 * 60 * 1000 // 7 days

    this.guide = [
      { key: 'account', label: 'CAIYUN-ACCOUNT', type: 'string', required: true },
      { key: 'token', label: 'CAIYUN-TOKEN', type: 'string', required: true },
    ]
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

    let { error, path, key, account, token, root_id } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#list`

    let r = app.cache.get(cacheId)

    if (r && !search) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let fid = path || root_id || DEFAULT_ROOT_ID

    let data = await this._list(account, token, fid)

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

    let { error, path, account, token } = await manager.parse(id)

    if (error) return { error }

    let [fid, pid] = path.split('@')

    if (!pid) return false

    let cacheId = `${id}#get`

    let r = app.cache.get(cacheId)

    if (r) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let parentData = await this._list(account, token, pid)

    if (parentData.error) return parentData

    let file = parentData.find((i) => i.extra.fid == fid)

    if (!file) {
      return {
        error: { code: 404, message: 'not found' },
      }
    }

    let data = { ...file, extra: { ...file.extra } }

    let download_url = await this.get_download_url(account, token, fid)

    if (download_url) {
      data.download_url = download_url
    }

    let expired_at = 10 * 3600 * 1000

    app.cache.set(id, data, expired_at - Date.now())

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
  async _list(account, token, id) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let offset = 0,
      children = []

    do {
      let params = {
        catalogID: id,
        sortDirection: 1,
        filterType: 0,
        catalogSortType: 0,
        contentSortType: 0,
        startNumber: offset + 1,
        endNumber: offset + 200,
      }

      let headers = createHeaders(params)

      let { data, error } = await request.post('https://yun.139.com/caiyun/openapi/storage/catalog/getDisk', {
        data: params,
        headers: {
          ...headers,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
          Cookie: `CAIYUN-TOKEN=${token}; CAIYUN-ACCOUNT=${account}`,
        },
        contentType: 'json',
      })

      if (error) return { error }

      if (data?.message) return { error: { message: data.message } }

      if (!data.data) return { error: { message: 'nothing' } }

      if (data.data?.catalogList?.catalogInfo) {
        for (let i of data.data.catalogList.catalogInfo) {
          children.push({
            id: i.catalogID,
            name: i.catalogName,
            type: 'folder',
            size: i.size,
            ctime: timestamp(datetimeFormat(i.createTime)),
            mtime: timestamp(datetimeFormat(i.updateTime)),
            extra: {
              fid: i.catalogID,
              parent_id: i.parentCatalogId,
              path: i.path,
            },
          })
        }
      }

      if (data.data?.contentList?.contentInfo) {
        for (let i of data.data.contentList.contentInfo) {
          children.push({
            id: i.contentID + '@' + i.parentCatalogId,
            name: i.contentName,
            type: 'file',
            size: i.contentSize,
            ctime: timestamp(datetimeFormat(i.uploadTime)),
            mtime: timestamp(datetimeFormat(i.updateTime)),
            thumb: i.thumbnailURL,
            extra: {
              fid: i.contentID,
              parent_id: i.parentCatalogId,
              path: i.path,
            },
          })
        }
      }

      if (offset + 200 < parseInt(data.data.nodeCount)) {
        offset += 200
      } else {
        break
      }
    } while (true)

    return children
  }

  async get_download_url(account, token, id) {
    const { request } = this.app

    let params = {
      appName: '',
      contentID: id,
    }

    let headers = createHeaders(params)

    let { data, error } = await request.post('https://yun.139.com/caiyun/openapi/storage/download/downloadRequest', {
      data: params,
      headers: {
        ...headers,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        Cookie: `CAIYUN-TOKEN=${token}; CAIYUN-ACCOUNT=${account}`,
      },
      contentType: 'json',
    })

    if (!error && data?.data) return data.data
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
