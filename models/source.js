const gd = require('./drive/googledrive')
const od = require('./drive/onedrive')
const remote = require('./drive/remote')

const providers = {gd , od ,  remote}

const file = async(id , p) => {
  if(providers[p]){
    return await providers[p].file(id)
  }
}

module.exports = file
