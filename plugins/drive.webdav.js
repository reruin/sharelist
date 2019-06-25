/*
 * WebDAV
 * http(s)://username:password@host.com:port/?acceptRanges=none
 * 如果webdav server 不支持 206，需要带上acceptRanges=none 标识
 */

const name = 'WebDAV'

const version = '1.0'

const protocols = ['webdav']

const defaultProtocol = 'webdav'

const path = require('path')

const { createClient } = require("webdav");

const { URL } = require("url")

const { Writable } = require('stream')

const clientMap = {}

module.exports = ({ getConfig, cache, base64 }) => {

  const extname = (p) => path.extname(p).substring(1)

  const getClient = async (url, cd = false) => {
    let { protocol , username, password, host, port, pathname , searchParams } = new URL(url);
    let remote_url = protocol + '//' + host + pathname
    let hit = clientMap[remote_url]

    if (!hit) {
      let client = createClient(remote_url,{
        username:decodeURIComponent(username),password:decodeURIComponent(password)
      });
      let options = {}
      searchParams.forEach((value, name) => {
        options[name] = value
      })

      clientMap[remote_url] = hit = { client , options }
    }
    
    return hit;
  }

  const folder = async (id) => {
    let [server , path] = id.split('>');
    let resp = { id : id, type: 'folder', protocol: defaultProtocol }

    /*
    let resid = `${defaultProtocol}:${id}`
    let r = cache.get(resid)

    if (r) {
      resp = r
      if (
        resp.$cached_at &&
        resp.children &&
        (Date.now() - resp.$cached_at < getConfig('max_age_dir'))

      ) {
        console.log('get webdav folder from cache')
        return resp
      }
    }
    */

    let { client } = await getClient(server)
    // console.log(path)
    if (client) {
      let data = await client.getDirectoryContents(path || '',{withCredentials:false});

      let children = [];
      data.forEach(i => {
        let path = (server + '>' + i.filename)
        let obj = {
          id: path,
          name: i.basename,
          protocol: defaultProtocol,
          size: i.size,
          created_at: i.lastmod,
          updated_at: i.lastmod,
          ext: extname(i.basename),
          mime:i.mime,
          type: i.type == 'directory' ? 'folder' : 'other'
        }
        
        children.push(obj)
      })

      resp.$cached_at = Date.now()
      resp.children = children
      //cache.set(resid, resp)

      return resp
    } else {
      return false
    }
  }

  const file = async (id , data = {}) => {
    
    data.url = id
    data.outputType = 'url'
    //data.proxy = 'stream'

    return data
  }

  const stream = async (url, options = {}) => {
    let [server, path] = url.split('>');
    let { client , options:clientOptions } = await getClient(server)

    if (client) {

      if(options.contentFormat){
        return await client.getFileContents(path , { format : 'text'})
      }else{
        let range = options.range

        let opts = {}
        if(clientOptions.acceptRanges != 'none' && options.range){
          opts.range = options.range
        }
        return {
          stream: client.createReadStream(path, opts),
          acceptRanges: false
        }
      }
      
    } else {
      return null
    }
  }

  return { name, version, drive: { protocols, folder, file, stream } }
}
