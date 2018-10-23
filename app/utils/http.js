const request = require('request')
const base = require('./base')
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
    opts.headers = base.extend(opts.headers || {} , headers)
    if(debug) opts.proxy = 'http://127.0.0.1:1087'
    return new Promise(function (resolve, reject) {
      request(opts, function(error, response, body){
          resolve(response)
        })
    })
  },

  header2(url , opts){
    opts = opts || {}
    opts.url = url
    opts.headers = base.extend(opts.headers || {} , headers)
    if(debug) opts.proxy = 'http://127.0.0.1:1087'
    return new Promise(function (resolve, reject) {
      let req = request(opts).on('response',(resp)=>{
        let headers = {}
        if(resp){
          headers = resp.headers || {}
        }

        let n = {}
        for(var i in headers){
          if(!['connection'].includes(i)){
            n[i] = headers[i]
          }
        }

        if( ! ('content-length' in n ) ){
          let range = n['content-range']
          if(range){
            let m = range.split('/')[1]
            if(!isNaN(parseInt(m))){
              n['content-length'] = parseInt(m)
            }
          }
        }

        resolve(n)

        req.abort()
      })
    })
  },

	get(url , opts ){
    opts = opts || {}
    let params = { ...opts }
    if(params.fake){
      delete params.fake
      let rndip = base.ip()
      params.headers = base.extend(params.headers || {}, {
        'PHPSESSID':'nrop',
        'CLIENT-IP':rndip,
        'HTTP_X_FORWARDED_FOR':rndip
      })

      base.extend(params.headers , headers)
    }else{
      params.headers = base.extend(params.headers || {} , headers)
    }

    params.url = url
    if(debug) params.proxy = 'http://127.0.0.1:1087'
    
    console.log('get ',url,params.proxy)
		return new Promise(function (resolve, reject) {
			request(params, function(error, response, body){
          if(error){
            console.log(error)
            reject(error)
          }else{
            resolve(response)
          }
		      // if (!error && response.statusCode == 200) {
		      //   resolve(body)
		      // }else{
        //     reject(error || response.statusCode);
		      // }
		    })
		})
	},

	post(url , form , fake){
		let headers = {
		    'Accept-Language':'zh-CN,zh;q=0.8',
		}
    if(fake){
      let rndip = base.ip()
      headers['PHPSESSID'] = 'fsef'
      headers['CLIENT-IP'] = rndip
      headers['HTTP_X_FORWARDED_FOR'] = rndip
    }
    
		return new Promise(function (resolve, reject) {
			request({url , form , headers} , function(error, response, body){
		      if (!error && response.statusCode == 200) {
		        resolve(body)
		      }else{
	           reject(error || response.statusCode);
		      }
		    })
		})
	}
}


