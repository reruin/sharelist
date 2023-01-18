class http {
  static options = {
    protocol: "http",
    singleton: true,
    mountable: false
  }

  constructor(app, config) {
    this.app = app
    this.config = config
  }

  pwd(id) {
    let name = id.split('/').pop()
    return [{ id, name, type: 'file' }]
  }

  async get(id) {
    let url = id
    let size = await this.getFileSize(url)
    let name = url.split('/').pop()
    return {
      id,
      size,
      name,
      type: 'file',
      ctime: Date.now(),
      mtime: Date.now(),
      download_url: url,
      extra: {}
    }
  }

  async list(id) {

  }

  async getFileSize(url, headers = {}) {
    try {
      let controller = new AbortController()
      let { headers: resHeaders } = await this.app.request(url, {
        signal: controller.signal,
        headers,
        responseType: 'stream'
      })
      controller.abort()
      let size = +resHeaders['content-length']
      return size
    } catch (e) {
      console.log(e)
      return null
    }

  }

  // async createReadStream({ id, options = {} } = {}) {
  //   let url = id
  //   let size = await this.getFileSize(url)
  //   let readstream = request({ url: decodeURIComponent(url), method: 'get' })
  //   return wrapReadableStream(readstream, { size })
  // }
}

class https extends http {
  static options = {
    protocol: "https",
    singleton: true,
    mountable: false
  }
  constructor(app, config) {
    super(app, config)
    this.protocol = 'https'
  }
}

exports.HTTPDriver = {
  name: 'http', hash: 'sharelist.http', module: { driver: http }
}
exports.HTTPSDriver = {
  name: 'https', hash: 'sharelist.https', module: { driver: https }
}