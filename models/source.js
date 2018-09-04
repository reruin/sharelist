const gd = require('./drive/googledrive')
const od = require('./drive/onedrive')
const ld = require('./drive/localdrive')
const remote = require('./drive/remote')
const http = require('../utils/http')
const fs = require('fs')
const providers = {gd , od , ld, remote}

const file = async(id , p) => {
  if(providers[p]){
    let d =  await providers[p].file(id)
    if(d.fs){
      if(fs.existsSync( d.url )){
        return fs.readFileSync(d.url, 'utf8')
      }
    }else{
      let data = await http.get(data.url)
      return data.body
    }
  }

  return false
}

module.exports = file
