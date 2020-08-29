const request = require('request')
const headers = {
  'Accept-Encoding': 'identity;q=1, *;q=0',
  'Accept-Language': 'zh-CN,zh;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.167 Safari/537.36'
}

const PROXY_URL = ''//'http://127.0.0.1:1080'
const http = (opts, ...rest) => {
  if (PROXY_URL) opts.proxy = PROXY_URL
  if (opts.async) {
    return new Promise(function(resolve, reject) {
      request(opts, function(error, response, body) {
        if (!error) {
          resolve(response)
        } else {
          reject(error || response);
        }
      })
    })
  } else {
    return request(opts, ...rest)
  }
}

http.req = (params) => {
  return new Promise(function(resolve, reject) {
    request(params, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        resolve(response)
      } else {
        reject(error || response);
      }
    })
  })
}
http.header = (url, opts) => {
  opts = opts || {}
  opts.url = url
  opts.method = 'HEAD'
  opts.headers = Object.assign({}, opts.headers, headers)
  if (PROXY_URL) opts.proxy = PROXY_URL
  return new Promise(function(resolve, reject) {
    request(opts, function(error, response, body) {
      if (error) {
        reject(error)
      } else {
        resolve(response.headers)
      }
    })
  })
}

http.get = (url, opts = {}) => {
  let params = { ...opts }
  params.headers = Object.assign({}, headers, params.headers || {})
  params.url = url

  if (PROXY_URL) {
    params.proxy = PROXY_URL
    //console.log('DEBUG:', params)
  }
  return new Promise(function(resolve, reject) {
    request(params, function(error, response, body) {
      if (error) {
        reject(error)
      } else {
        resolve(response)
      }
    })
  })
}

http.post = (url, form = {}, opts = {}) => {
  let params = { ...opts }
  params.headers = Object.assign({}, headers, params.headers || {})
  params.url = url
  if (opts.is_body || opts.body === true) {
    params.body = form
  } else if (opts.isFormData) {
    params.formData = form
  } else {
    params.form = form
  }
  params.method = 'POST'
  if (PROXY_URL) {
    params.proxy = PROXY_URL
    //console.log('DEBUG:', params)
  }
  return new Promise(function(resolve, reject) {
    request(params, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        resolve(response)
      } else {
        reject(error || response);
      }
    })
  })
}

module.exports = http