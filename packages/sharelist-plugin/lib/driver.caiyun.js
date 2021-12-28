/**
 * Caiyun
 */

const crypto = require('crypto')

const protocol = 'caiyun'

const DEFAULT_ROOT_ID = '00019700101000000001'

const UPLOAD_PART_SIZE = 10 * 1024 * 1024

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

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


//base64 encode
const btoa = (v) => Buffer.from(v).toString('base64')

const utob = (str) => {
  const u = String.fromCharCode
  return str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g, (t) => {
    if (t.length < 2) {
      var e = t.charCodeAt(0);
      return e < 128 ? t : e < 2048 ? u(192 | e >>> 6) + u(128 | 63 & e) : u(224 | e >>> 12 & 15) + u(128 | e >>> 6 & 63) + u(128 | 63 & e)
    }
    e = 65536 + 1024 * (t.charCodeAt(0) - 55296) + (t.charCodeAt(1) - 56320);
    return u(240 | e >>> 18 & 7) + u(128 | e >>> 12 & 63) + u(128 | e >>> 6 & 63) + u(128 | 63 & e)
  })
}

const unicode = (s) => s.split('').map((c) => ('\\u' + ('0000' + c.charCodeAt(0).toString(16).toUpperCase()).slice(-4))).join('')

const getNewSign = (e, t, a, n) => {
  var r = "",
    i = "";
  if (t) {
    var s = Object.assign({}, t);
    i = JSON.stringify(s),
      i = i.replace(/\s*/g, ""),
      i = encodeURIComponent(i);
    var c = i.split(""),
      u = c.sort();
    i = u.join("")
  }
  var A = md5(btoa(utob(i))),
    l = md5(a + ":" + n);
  return md5(A + l).toUpperCase()
}

const datetimeFormat = (d) =>
  d ? d.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3 $4:$5:$6+08:00') : ''

const moment = (a, expr = 'yyyy-MM-dd hh:mm:ss') => {
  let y = a.getFullYear(),
    M = a.getMonth() + 1,
    d = a.getDate(),
    D = a.getDay(),
    h = a.getHours(),
    m = a.getMinutes(),
    s = a.getSeconds(),
    w = a.getDay()

  const zeroize = v => `${v > 9 ? '' : '0'}${v}`

  return expr.replace(/(?:s{1,2}|w{1,2}|m{1,2}|h{1,2}|d{1,2}|M{1,4}|y{1,4})/g, function (str) {

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

const createHeaders = (body) => {
  // let timestamp = Date.now()
  // let key = getRandomSring(16)

  let timestamp = moment(new Date())
  let key = getRandomSring(16)
  let sign = getNewSign(undefined, body, timestamp, key)

  let headers = {
    'x-huawei-channelSrc': '10000034',
    'x-inner-ntwk': '2',
    'mcloud-channel': '1000101',
    'mcloud-client': '10701',
    'mcloud-sign': timestamp + "," + key + "," + sign,
    // 'mcloud-skey': null,

    'content-type': "application/json;charset=UTF-8",
    'caller': 'web',
    'CMS-DEVICE': 'default',
    'x-DeviceInfo': '||9|85.0.4183.83|chrome|85.0.4183.83|||windows 10||zh-CN|||',
    'x-SvcType': '1',
    'referer': 'https://yun.139.com/w/',

  }

  // let headers = {
  //   caller: 'web',
  //   'CMS-CLIENT': '0010101',
  //   'CMS-DEVICE': 'default',
  //   'CMS-SIGN': timestamp + ',' + key + ',' + getSign(undefined, body, timestamp, key),
  //   'x-DeviceInfo': '||9|92.0.4515.107|chrome|92.0.4515.107|||windows 10||zh-CN|||',
  //   Referer: 'https://yun.139.com/w/',
  // }

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

      if (!key && data.mobile) {
        data.key = key = data.mobile
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

      // 处理起始目录
      if (!data.path) {
        data.path = data.root_id || DEFAULT_ROOT_ID
        needUpdate = true
      }

      if (needUpdate) {
        await this.app.saveDrive(data, { token: data.token })
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

    if (!credentials || !credentials.token || !credentials.account || !credentials.mobile) {
      return { error: { message: 'unmounted' } }
    }

    return { ...credentials, cookie: `ORCHES-C-TOKEN=${credentials.token}; ORCHES-C-ACCOUNT=${credentials.account}; ORCHES-I-ACCOUNT-ENCRYPT=${credentials.encrypt}; ` }
  }
}

const getRealId = v => [v.split('/').pop().replace('@f', ''), v.endsWith('@f'), v.split('/').slice(0, -1).join('/')]

module.exports = class Driver {
  constructor() {
    this.name = 'CaiYun'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 7 * 24 * 60 * 60 * 1000 // 7 days

    this.guide = [
      { key: 'account', label: 'ORCHES-C-ACCOUNT', type: 'string', help: '登录官网从cookies中获取ORCHES系列参数', required: true },
      { key: 'token', label: 'ORCHES-C-TOKEN', type: 'string', required: true },
      { key: 'encrypt', label: 'ORCHES-I-ACCOUNT-ENCRYPT', type: 'string', required: true },
      { key: 'mobile', label: '手机号', type: 'string', required: true },
      { key: 'root_id', label: '初始目录ID', type: 'string', required: false },
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
  * Lists or search files
  *
  * @param {string} [id] folder id
  * @param {object} [options] list options
  * @param {object} [options.sort] sort
  * @param {object} [options.search] search
  * @param {string} [key] key
  * @return {array}
  *
  * @api public
  */
  async list(id, options = {}, key) {
    let { cookie, mobile } = await this.getCredentials(key)
    let [fid, isFile] = getRealId(id)

    if (isFile) {
      return []
    }

    const {
      request,
      utils: { timestamp },
    } = this.app

    let offset = 0, size = 200, files = []

    do {
      let params = {
        catalogID: fid,
        sortDirection: 1,
        filterType: 0,
        catalogSortType: 0,
        contentSortType: 0,
        startNumber: offset + 1,
        endNumber: offset + size,
        commonAccountInfo: { account: mobile, accountType: 1 }
      }

      let headers = createHeaders(params)

      let { data } = await request.post('https://yun.139.com/orchestration/personalCloud/catalog/v1.0/getDisk', {
        data: params,
        headers: {
          ...headers,
          cookie,
        },
        contentType: 'json',
      })

      if (!data.success) return this.app.error({ message: data.message })

      if (data.data.result.resultCode != '0') this.app.error({ message: data.data.result.resultDesc })

      data = data.data.getDiskResult

      if (data?.catalogList) {
        for (let i of data.catalogList) {
          files.push({
            id: id + '/' + i.catalogID,
            name: i.catalogName,
            type: 'folder',
            size: i.size,
            ctime: timestamp(datetimeFormat(i.createTime)),
            mtime: timestamp(datetimeFormat(i.updateTime)),
            extra: {
              fid: id + '/' + i.catalogID,
              parent_id: id,
            },
          })
        }
      }

      if (data?.contentList) {
        for (let i of data.contentList) {
          files.push({
            id: id + '/' + i.contentID + '@f',
            name: i.contentName,
            type: 'file',
            size: i.contentSize,
            ctime: timestamp(datetimeFormat(i.uploadTime)),
            mtime: timestamp(datetimeFormat(i.updateTime)),
            thumb: i.thumbnailURL,
            extra: {
              fid: id + '/' + i.contentID + '@f',
              parent_id: id,
              // path: i.path,
              preview_url: i.presentURL
            },
          })
        }
      }

      if (offset + size < parseInt(data.nodeCount)) {
        offset += size
      } else {
        break
      }
    } while (true)

    return files
  }

  // caiyun 没有获取文件详情的单独接口
  async get(id, key) {
    let paths = id.split('/')
    let [fid, isFile] = getRealId(id)

    const data = {
      id,
      type: isFile ? 'file' : 'folder',
      extra: {
        fid: id,
        parent_id: paths.slice(0, -1).join('/')
      },
    }

    if (data.type == 'file') {
      let { url, max_age } = await this.get_download_url(id, key)
      data.download_url = url
      data.max_age = max_age
    }
    return data
  }

  async get_download_url(id, key) {
    let { cookie, mobile } = await this.getCredentials(key)
    let [fid, isFile] = getRealId(id)

    const { request } = this.app

    let params = {
      appName: '',
      contentID: fid,
      commonAccountInfo: { account: mobile, accountType: 1 }
    }

    let headers = createHeaders(params)

    try {

      let { data } = await request.post('https://yun.139.com/orchestration/personalCloud/uploadAndDownload/v1.0/downloadRequest', {
        data: params,
        headers: {
          ...headers,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
          cookie,

        },
        contentType: 'json',
      })
      if (data?.data?.downloadURL) return { url: data.data.downloadURL, max_age: 1 * 60000 }
    } catch (e) {
      return {}
    }

  }

  async mkdir(parentId, name, { check_name_mode = 'refuse' }, key) {
    const { request } = this.app
    let { cookie, mobile } = await this.getCredentials(key)
    let [fid] = getRealId(parentId)

    let params = {
      createCatalogExtReq: {
        parentCatalogID: fid,
        newCatalogName: name,
        commonAccountInfo: { account: mobile, accountType: 1 }
      }
    }

    let headers = createHeaders(params)

    let { data } = await request.post('https://yun.139.com/orchestration/personalCloud/catalog/v1.0/createCatalogExt', {
      data: params,
      headers: {
        ...headers,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        cookie,
      },
      contentType: 'json',
    })

    if (!data.success) return this.app.error({ message: data.message })

    if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })

    let file_id = data.data.catalogInfo.catalogID

    /*
    parentCatalogId: "0511YJIR62Bj00019700101000000043"
    path: "00019700101000000001/0511YJIR62Bj00019700101000000043/0511YJIR62Bj06720210909171001rec"
    */
    return {
      id: parentId + '/' + file_id,
      name,
      parent_id: parentId
    }
  }

  async rename(id, name, { check_name_mode = 'refuse' } = {}, key) {
    const { request } = this.app
    let { cookie, mobile } = await this.getCredentials(key)

    let [fid, isFile, parent_id] = getRealId(id)

    let params = {
      [isFile ? 'contentID' : 'catalogID']: fid,
      [isFile ? 'contentName' : 'catalogName']: name,
      commonAccountInfo: { "account": mobile, "accountType": 1 }
    }

    let headers = createHeaders(params)

    let { data } = await request.post(`https://yun.139.com/orchestration/personalCloud/content/v1.0/${isFile ? 'updateContentInfo' : 'updateCatalogInfo'}`, {
      data: params,
      headers: {
        ...headers,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        cookie,
      },
      contentType: 'json',
    })

    if (!data.success) return this.app.error({ message: data.message })

    if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })

    return {
      id,
      name: data.data.updateContentInfoRes?.contentName || data.data.updateCatalogRes.catalogName,
      parent_id
    }

  }

  async rm(id, key) {
    const { request } = this.app
    const { cookie, mobile } = await this.getCredentials(key)
    let [fid, isFile, parent_id] = getRealId(id)

    let params = {
      "createBatchOprTaskReq": {
        "taskType": 2,
        "actionType": 201,
        "taskInfo": {
          "newCatalogID": "",
          [isFile ? 'contentInfoList' : 'catalogInfoList']: [fid]
        },
        "commonAccountInfo": { "account": mobile, "accountType": 1 }
      }
    }

    let headers = createHeaders(params)

    let { data, error } = await request.post('https://yun.139.com/orchestration/personalCloud/batchOprTask/v1.0/createBatchOprTask', {
      data: params,
      headers: {
        ...headers,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        cookie,
      },
      contentType: 'json',
    })
    if (!data.success) return this.app.error({ message: data.message })

    if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })

    let taskId = data.data.createBatchOprTaskRes.taskID
    await this.waitTask(taskId, key)

    return { id, parent_id }
  }

  /**
   * mv file/folder
   *
   * @param {string} [id] folder id
   * @return {string | error}
   *
   * @api public
   */
  async mv(id, target_id, key) {
    const { request } = this.app
    const { cookie, mobile } = await this.getCredentials(key)
    let [fid, isFile, parent_id] = getRealId(id)
    let [targetFid] = getRealId(target_id)
    let params = {
      "createBatchOprTaskReq": {
        "taskType": 3,
        "actionType": 304,
        "taskInfo": {
          "contentInfoList": [],
          "catalogInfoList": [],
          "newCatalogID": targetFid,
          [isFile ? 'contentInfoList' : 'catalogInfoList']: [fid]
        },
        "commonAccountInfo": { "account": mobile, "accountType": 1 }
      }
    }

    let headers = createHeaders(params)

    let { data } = await request.post('https://yun.139.com/orchestration/personalCloud/batchOprTask/v1.0/createBatchOprTask', {
      data: params,
      headers: {
        ...headers,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        cookie,
      },
      contentType: 'json',
    })

    if (!data.success) return this.app.error({ message: data.message })

    if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })

    let taskId = data.data.createBatchOprTaskRes.taskID

    await this.waitTask(taskId, key)

    //TODO id 移动到 target_id 下
    let newId = target_id + '/' + id.split('/').pop()
    return { id: newId, parent_id }
  }

  /**
   * copy file/folder
   *
   * @param {string} [id] folder id
   * @param {string} [target_id] target_id
   * @return {string | error}
   *
   * @api public
   */
  async copy(id, target_id, key) {
    const { request } = this.app
    const { cookie, mobile } = await this.getCredentials(key)
    let [fid, isFile, parent_id] = getRealId(id)
    let [targetFid] = getRealId(target_id)
    let params = {
      "createBatchOprTaskReq": {
        "taskType": 3,
        "actionType": 309,
        "taskInfo": {
          "contentInfoList": [],
          "catalogInfoList": [],
          "newCatalogID": targetFid,
          [isFile ? 'contentInfoList' : 'catalogInfoList']: [fid]
        },
        "commonAccountInfo": { "account": mobile, "accountType": 1 }
      }
    }

    let headers = createHeaders(params)

    let { data } = await request.post('https://yun.139.com/orchestration/personalCloud/batchOprTask/v1.0/createBatchOprTask', {
      data: params,
      headers: {
        ...headers,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        cookie,
      },
      contentType: 'json',
    })

    if (!data.success) return this.app.error({ message: data.message })

    if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })

    let taskId = data.data.createBatchOprTaskRes.taskID

    await this.waitTask(taskId, key)

    //TODO id 移动到 target_id 下
    let newId = target_id + '/' + id.split('/').pop()
    return { id: newId, parent_id }
  }

  async waitTask(taskId, key) {
    const { request } = this.app
    const { cookie, mobile } = await this.getCredentials(key)

    let params = {
      "queryBatchOprTaskDetailReq": {
        "taskID": taskId,
        "commonAccountInfo": { "account": mobile, "accountType": 1 }
      }
    }

    let retry = 3

    while (retry--) {
      let headers = createHeaders(params)

      let { data, error } = await request.post('https://yun.139.com/orchestration/personalCloud/batchOprTask/v1.0/queryBatchOprTaskDetail', {
        data: params,
        headers: {
          ...headers,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
          cookie,
        },
        contentType: 'json',
      })
      if (data?.data?.queryBatchOprTaskDetailRes?.batchOprTask?.progress == 100) {
        return true
      }

      await sleep(200)
    }
    return false
  }

  async beforeUpload(id, { name, size }, key) {
    const { cookie, mobile } = await this.getCredentials(key)
    const [fid] = getRealId(id)
    const params = {
      "manualRename": 2,
      "operation": 0,
      "fileCount": 1,
      "totalSize": size,
      "uploadContentList": [{
        "contentName": name,
        "contentSize": size,
        // "digest": "5a3231986ce7a6b46e408612d385bafa"
      }],
      "parentCatalogID": fid,
      "newCatalogName": "",
      "commonAccountInfo": { "account": mobile, "accountType": 1 }
    }

    let headers = createHeaders(params)

    let { data } = await this.app.request.post('https://yun.139.com/orchestration/personalCloud/uploadAndDownload/v1.0/pcUploadFileRequest', {
      data: params,
      headers: {
        ...headers,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        cookie,
      },
      contentType: 'json',
    })

    if (!data.success) return this.app.error({ message: data.message })

    if (data.data.result.resultCode != '0') return this.app.error({ message: data.data.result.resultDesc })

    return data.data.uploadResult
  }

  async upload(parent_id, { size, name, stream, ...rest }, key) {
    const { app } = this
    let res = await this.beforeUpload(parent_id, { name, size, ...rest }, key)
    let upload_url = res.redirectionUrl
    let taskId = res.uploadTaskID
    let contentId = res.newContentIDList.contentID

    if (!upload_url) {
      //no need
      return { id: parent_id + '/' + contentId + '@f', name, parent_id }
    }

    let passStream = app.createReadStream(stream, { highWaterMark: 2 * UPLOAD_PART_SIZE })
    let part = Math.ceil(size / UPLOAD_PART_SIZE)
    let point = 0
    for (let i = 0; i < part; i++) {
      let buffer = await passStream.read(UPLOAD_PART_SIZE)
      let ret = await app.request.post(upload_url, {
        data: buffer,
        contentType: 'buffer',
        responseType: 'text',
        headers: {
          'Accept': '*/*',
          'Content-Type': `text/plain;name=${unicode(name)}`,
          'contentSize': size,

          'range': `bytes=${point}-${point + buffer.length - 1}`,
          'content-length': buffer.length,

          'uploadtaskID': taskId,
          'rangeType': 0,
          'Referer': 'https://yun.139.com/',
          'x-SvcType': 1,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
        }
      })
      point += buffer.length
    }

    return { id: parent_id + '/' + contentId + '@f', name, parent_id }
  }
}
