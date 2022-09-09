const fetch = require('node-fetch')

const btoa = (v) => Buffer.from(v).toString('base64')

const https = require('https')

const http = require('http')

const { URL } = require('url')

class LRUCache {
  constructor(size = 10) {
    this.size = size
    this.store = new Map()
    this.index = []
  }
  update(key) {
    let index = this.index
    let idx = index.indexOf(key)
    let cur = index[idx]

    //update index
    index.splice(idx, 1)
    index.unshift(cur)
  }
  get(key) {
    const { store } = this
    // update
    if (store.has(key)) {
      this.update(key)
      return store.get(key)
    }
  }
  set(key, val) {
    const { store, index } = this
    if (store.has(key)) {
      this.update(key)
    } else {
      if (store.size >= this.size) {
        let delKey = index.pop()
        store.delete(delKey)
      }
      index.unshift(key)
    }
    store.set(key, val)
  }
}

const lruCache = new LRUCache()

const createAgent = (proxy, isHttpsAgent = true) => {
  const proxyParsed = typeof proxy === 'string'
    ? new URL(proxy)
    : proxy

  const agent = isHttpsAgent ? new https.Agent() : new http.Agent()

  agent.proxy = proxyParsed
  agent.superCreateConnection = agent.createConnection
  agent.createConnection = function (options, callback) {
    const proxyParsed = this.proxy
    const isHttpsAgent = this instanceof https.Agent

    const isHttpsTunnel = proxyParsed.protocol === 'https:'

    const requestOptions = {
      method: 'CONNECT',
      host: proxyParsed.hostname,
      port: proxyParsed.port,
      path: `${options.host}:${options.port}`,
      setHost: false,
      headers: { connection: this.keepAlive ? 'keep-alive' : 'close', host: `${options.host}:${options.port}` },
      agent: false,
      timeout: options.timeout || 0
    }

    if (proxyParsed.username || proxyParsed.password) {
      const base64 = Buffer.from(`${decodeURIComponent(proxyParsed.username || '')}:${decodeURIComponent(proxyParsed.password || '')}`).toString('base64')
      requestOptions.headers['proxy-authorization'] = `Basic ${base64}`
    }

    // Necessary for the TLS check with the proxy to succeed.
    if (isHttpsTunnel) {
      requestOptions.servername = this.proxy.hostname
    }
    //console.log('request', requestOptions)
    const request = (isHttpsTunnel ? https : http).request(requestOptions)

    request.once('connect', (response, socket, head) => {
      request.removeAllListeners()
      socket.removeAllListeners()
      if (response.statusCode === 200) {
        callback(null, isHttpsAgent ? this.superCreateConnection({ ...options, socket }) : socket)
      } else {
        callback(new Error(`Bad response: ${response.statusCode}`), null)
      }
    })

    request.once('timeout', () => {
      request.destroy(new Error('Proxy timeout'))
    })

    request.once('error', err => {
      request.removeAllListeners()
      callback(err, null)
    })

    request.end()
  }
  return agent
}

const createProxyAgent = (proxy, isHttpsAgent = false) => {
  let key = (isHttpsAgent ? 'https' : 'http') + '+' + proxy
  let agent = lruCache.get(key)
  if (!agent) {
    try {
      agent = createAgent(proxy, isHttpsAgent)
      lruCache.set(key, agent)
    } catch (e) {
      console.log(e)
      return
    }

  }
  return agent
}

// {
//   // These properties are part of the Fetch Standard
//   method: 'GET',
//   headers: {},        // request headers. format is the identical to that accepted by the Headers constructor (see below)
//   body: null,         // request body. can be null, a string, a Buffer, a Blob, or a Node.js Readable stream
//   redirect: 'follow', // set to `manual` to extract redirect headers, `error` to reject redirect
//   signal: null,       // pass an instance of AbortSignal to optionally abort requests

//   // The following properties are node-fetch extensions
//   follow: 20,         // maximum redirect count. 0 to not follow redirect
//   timeout: 0,         // req/res timeout in ms, it resets on redirect. 0 to disable (OS limit applies). Signal is recommended instead.
//   compress: true,     // support gzip/deflate content encoding. false to disable
//   size: 0,            // maximum response body size in bytes. 0 to disable
//   agent: null         // http(s).Agent instance or function that returns an instance (see below)
// }

const each = (src, fn) => {
  let ret = {}
  for (let i in src) {
    ret[i.toLowerCase()] = fn(src[i], i)
  }
  return ret
}

const convToLowerCase = (props) => {
  let ret = {}
  Object.keys(props).forEach(key => {
    ret[key.toLowerCase()] = props[key]
  })
  return ret
}

const qs = (data) => {
  let c = {}
  Object.keys(data).forEach(i => {
    c[i] = typeof data[i] == 'object' ? JSON.stringify(data[i]) : data[i]
  })
  return new URLSearchParams(c)
}

const request = async (url, options = {}) => {
  let {
    data,
    method = 'GET',
    contentType,
    responseType = 'json',
    followRedirect = true,
    maxRedirects = 10,
    auth,
    headers = {},
    agent,
    compress = false,
    timeout = 5000,
    retry = 2,
    proxy,
    ...rest
  } = options
  let args = { method: method.toUpperCase(), size: 0, agent, compress, timeout, headers: convToLowerCase(headers), ...rest }

  if (proxy) {
    args.agent = (urlParsed) => createProxyAgent(proxy, urlParsed.protocol === 'https:')
  }
  if (auth) {
    args.headers['authorization'] = `Basic ${btoa(auth)}`
  }

  if (!args.headers['user-agent']) {
    args.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
  }

  if (followRedirect) {
    args.redirect = 'follow'
    if (maxRedirects) args.follow = maxRedirects
  } else {
    args.redirect = 'manual'
  }


  if (data) {
    if (Buffer.isBuffer(data) || !!data?.pipe) {
      retry = 0
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(args.method)) {
      url += (url.includes('?') ? '' : '?') + new URLSearchParams(data).toString()
    } else {
      if (contentType == 'json') {
        args.body = JSON.stringify(data)
        if (!args.headers['content-type']) {
          args.headers['content-type'] = 'application/json'
        }
      } else if (contentType == 'form') {
        args.body = qs(data)
        // if (!args.headers['content-type']) {
        //   args.headers['content-type'] = 'application/x-www-form-urlencoded'
        // }
      } else {
        args.body = data
        args.timeout = 0
      }
    }
  }
  // console.log('[REQUEST]', url, args)
  // url = 'https://api.reruin.net/proxy?url=' + (url)

  while (true) {
    try {
      let res = await fetch(url, args)
      let status = res.status
      let headers = each(res.headers.raw(), (val) => val.join(','))
      if (responseType == 'json' || responseType == 'text' || responseType == 'buffer') {
        let data = await res[responseType]()

        return {
          status,
          headers,
          data,
        }
      } else {
        return { status, headers, data: res.body }
      }
    } catch (e) {
      console.log('request retry', retry, e)

      if (retry-- <= 0) {
        throw { message: '[' + e.code + '] The error occurred during the request.', type: e.type }
        // return { error: { message: '[' + e.code + '] The error occurred during the request.' } }
      }
    }
  }

}

request.post = (url, options) => request(url, { ...options, method: 'POST' })

request.get = (url, options) => request(url, { ...options, method: 'GET' })

module.exports = request