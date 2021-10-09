const fetch = require('node-fetch')

const https = require('https')

const btoa = (v) => Buffer.from(v).toString('base64')

const querystring = require('querystring')

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
    ret[i] = fn(src[i], i)
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
    timeout = 3000,
    retry = 2,
  } = options

  let args = { method: method.toUpperCase(), size: 0, agent, compress, timeout, headers: convToLowerCase(headers) }

  // if (!args.agent) {
  //   args.agent = function (_parsedURL) {
  //     if (_parsedURL.protocol == 'https:') {
  //       return new https.Agent({
  //         rejectUnauthorized: false,
  //       })
  //     }
  //   }
  // }

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
    if (Buffer.isBuffer(data)) {
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
          body: data,
        }
      } else {
        return { status, headers, data: res.body }
      }
    } catch (e) {
      if (retry-- <= 0) {
        throw { message: '[' + e.code + '] The error occurred during the request.' }
        // return { error: { message: '[' + e.code + '] The error occurred during the request.' } }
      }
      console.log('request retry', retry, e)
    }
  }

}

request.post = (url, options) => request(url, { ...options, method: 'POST' })

request.get = (url, options) => request(url, { ...options, method: 'GET' })

module.exports = request
