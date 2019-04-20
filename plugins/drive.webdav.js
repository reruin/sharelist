/*
 * WebDAV
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

module.exports = ({ getConfig, cache , base64 }) => {

  const extname = (p) => path.extname(p).substring(1)

  const getPath = (url) => {
    let { pathname } = new URL('ftp:' + url);
    return pathname
  }

  const getClient = async (url, cd = false) => {
    let key = (url.match(/https?\:\/\/[\w\W]+?\//) || [''])[0];
    let { protocol , username, password, host, port, pathname } = new URL(url);
    let client = clientMap[key]
    let remote_url = protocol + '//' + host + pathname
    if (!client) {
      // client = createClient('https://dervoerin.stor.backup.50network.com:2078/',{
      //   username:'webdav@reruin.backup-hosting.50network.com',password:'@Wuting0122'
      // });
      client = createClient(remote_url,{
        username:decodeURIComponent(username),password:decodeURIComponent(password)
      });
      clientMap[key] = client
    }
    
    return client;

  }

  const folder = async (id) => {
    let [server , path] = id.split('>');
    let resp = { id: id, type: 'folder', protocol: defaultProtocol }

    /*
    let resid = `${defaultProtocol}:${id}`
    let r = cache(resid)

    if (r) {
      resp = r
      if (
        resp.$cached_at &&
        resp.children &&
        (Date.now() - resp.$cached_at < getConfig().max_age_dir)

      ) {
        console.log('get webdav folder from cache')
        return resp
      }
    }
    */

    let client = await getClient(server)
    // console.log(path)
    if (client) {
      let data = await client.getDirectoryContents(path || '/');

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
      //cache(resid, resp)

      return resp
    } else {
      return false
    }
  }

  const file = async (id , data = {}) => {
    
    data.url = id
    data.outputType = 'stream'
    data.proxy = 'stream'

    return data
  }

  const stream = async (url, options = {}) => {
    let [server , path] = url.split('>');
    let client = await getClient(server, true)

    if (client) {
      let writeStream = options.writeStream;
      let headers = Object.assign({},options.headers);
      let fileSize = options.data ? options.data.size : 0
      if(options.range && options.range.length == 2 && fileSize){
        headers['Content-Range'] = 'bytes ' + `${options.range[0]}-${options.range[1]}/${fileSize}`
      }
      if (writeStream) {
        return client.createReadStream(path , {headers}).pipe(writeStream)
      } else {
        return await client.getFileContents(path)
      }
    } else {
      return null
    }
  }

  return { name, version, drive: { protocols, folder, file, stream } }
}
