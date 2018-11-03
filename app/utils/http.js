const request = require('request')
const debug = false //process.env.NODE_ENV == 'dev'
const headers = {
    'Accept-Encoding': 'identity;q=1, *;q=0',
    'Accept-Language':'zh-CN,zh;q=0.8',
    'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.167 Safari/537.36'
}
module.exports = {
  header(url, opts){
    opts = opts || {}
    opts.url = url
    opts.method = 'HEAD'
    opts.headers = Object.assign({} , opts.headers , headers)
    if(debug) opts.proxy = 'http://127.0.0.1:1087'
    return new Promise(function (resolve, reject) {
      request(opts, function(error, response, body){
          resolve(response)
        })
    })
  },


  stream( opts ){
    if(debug) opts.proxy = 'http://127.0.0.1:1087'
    return request(opts) 
  },
	get(url , opts = {}){
    let params = { ...opts }
    params.headers = Object.assign({} , params.headers , headers)
    params.url = url

    if(debug) {
      params.proxy = 'http://127.0.0.1:1087'
      console.log(params)
    }
		return new Promise(function (resolve, reject) {
			request(params, function(error, response, body){
        if(error){
          console.log(error)
          reject(error)
        }else{
          resolve(response)
        }
	    })
		})
	},

	post(url , form , opts){
    let params = { ...opts }
    params.headers = Object.assign({} , params.headers , headers)
    params.url = url
    params.form = form
    params.method = 'POST'

		return new Promise(function (resolve, reject) {
			request(params , function(error, response, body){
	      if (!error && response.statusCode == 200) {
	        resolve(body)
	      }else{
           reject(error || response.statusCode);
	      }
	    })
		})
	}
}


