/*
 * h5ai
 * h5ai 列目录
 */

const name = 'h5ai-beta'

const version = '1.0'

const protocols = ['h5ai']

const defaultProtocol = 'h5ai'

const path = require('path')

const { URL } = require("url")

const { Writable } = require('stream')

const clientMap = {}

module.exports = ({ request , getConfig, cache, base64 , retrieveSize, extname }) => {

  const getContent = async (p) => {
    let resp = await request.get(p)
    const data = []
    if( resp.body ){
      resp.body.replace(/<tr><td.*?>(.*?)<\/td><td.*?><a.*?>(.*?)<\/a><\/td><td.*?>(.*?)<\/td><td.*?>(.*?)<\/td><\/tr>/g,($0,$1,$2,$3,$4) => {
        if($0.indexOf('href=".."') == -1){
          data.push({
            type:$1.indexOf('folder') >=0 ? 'folder' : 'file',
            filename:$2,
            lastmod:$3,
            size:retrieveSize($4),
          })
        }
      })
    }
    return data
  }


  const folder = async (id) => {
    //let [server , path] = id.split('>');
    let resp = { id : id, type: 'folder', protocol: defaultProtocol }

    let data = await getContent(id)

    let children = [];
    data.forEach(i => {
      let path = (id + '/' + i.filename)
      let obj = {
        id: path,
        name: i.filename,
        protocol: defaultProtocol,
        size: i.size,
        created_at: i.lastmod,
        updated_at: i.lastmod,
        ext: extname(i.filename),
        type: i.type
      }
      
      children.push(obj)
    })

    resp.$cached_at = Date.now()
    resp.children = children
    //cache.set(resid, resp)

    return resp
  }

  const file = async (id , { data = {} } = {}) => {
    
    data.url = id
    // data.outputType = 'stream'
    //data.proxy = 'stream'
    return data
  }

  return { name, version, drive: { protocols, folder, file } }
}
