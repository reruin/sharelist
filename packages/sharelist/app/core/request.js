const fetch = require('node-fetch')

const btoa = v => Buffer.from(v).toString('base64')

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

module.exports = (app) => {
  const request = async (url, options = {}) => {
    let { data, method = 'GET', contentType, responseType = 'json', followRedirect = true, maxRedirects = 10, auth, headers = {}, agent, compress = false, timeout = 3000, retry = 2 } = options

    let args = { method, size: 0, agent, compress, timeout, headers }

    if (auth) {
      args.headers['authorization'] = `Basic ${btoa(auth)}`
    }

    if (followRedirect) {
      args.redirect = 'follow'
      if (maxRedirects) args.follow = maxRedirects
    } else {
      args.redirect = 'manual'
    }

    if (!args.headers['content-type'] && method != 'GET') {
      if (contentType === 'json') {
        args.headers['content-type'] = 'application/json'
      } else {
        args.headers['content-type'] = 'application/x-www-form-urlencoded'
      }
    }

    if (data) {
      if (['GET', 'HEAD'].includes(method)) {
        url += (url.includes('?') ? '' : '?') + querystring.stringify(data)
      } else if (['POST', 'PUT', 'DELETE'].includes(method)) {
        if (args.headers['content-type'].includes('application/json')) {
          args.body = JSON.stringify(data)
        } else {
          args.body = querystring.stringify(data)
        }
      }
    }

    //url = 'https://api.reruin.net/proxy?url=' + encodeURIComponent(url)

    while (true) {
      try {
        // console.log(url, args)
        let res = await fetch(url, args)
        let status = res.status
        let headers = each(res.headers.raw(), val => val.join(','))

        if (responseType == 'json' || responseType == 'text' || responseType == 'buffer') {
          let data = await res[responseType]()
          return {
            status,
            headers,
            data,
            body: data
          }
        } else {
          return { status, headers, data: res.body }
        }

      } catch (e) {
        if (retry-- <= 0) {
          return { error: { message: '[' + e.code + '] The error occurred during the request.' } }
        }
        console.log('request retry', retry, e)
      }
    }

    // return fetch(url, args).then(res => {
    //   let status = res.status
    //   let headers = each(res.headers.raw(), val => val.join(','))

    //   if (responseType == 'json' || responseType == 'text' || responseType == 'buffer') {
    //     return res[responseType]().then(data => ({ status, headers, data, body: data }))
    //   } else {
    //     return { status, headers, data: res.body }
    //   }
    // })
  }

  request.post = (url, options) => request(url, { ...options, method: 'POST' })

  request.get = (url, options) => request(url, { ...options, method: 'GET' })

  return request
}