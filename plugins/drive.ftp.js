/*
 * FTP >> Deprecated
 */

const name = '(Deprecated)FTP'

const version = '1.0'

const protocols = ['ftp']

const defaultProtocol = 'ftp'

const path = require('path')

const ftp = require("basic-ftp")

const { URL } = require("url")

const { PassThrough } = require('stream')

const clientMap = {}

module.exports = ({ getConfig, cache }) => {

  const extname = (p) => path.extname(p).substring(1)

  const getClient = async (url, cd = false) => {
    let key = (url.match(/ftp\:\/\/[\w\W]+?\//) || [''])[0];
    let { username, password, hostname, port, pathname } = new URL(url);
    /*
    let client = clientMap[key]

    if (client && client.closed == false) {
      if (pathname) {
        if (cd) {
          pathname = pathname.replace(/\/[^\/]+?$/, '')
        }
        console.log('cd1')
        await client.cd(pathname);
      }
      return client
    } 
    */
    let client = new ftp.Client();
    let flag = false
    client.ftp.verbose = true
    try {
      let p = await client.access({
        host: hostname,
        user: decodeURIComponent(username),
        password: decodeURIComponent(password),
        port: port || 21,
        secure: false
      })
      if (pathname) {
        if (cd) {
          pathname = pathname.replace(/\/[^\/]+?$/, '')
        }
        await client.cd(pathname);
      }
      flag = true
    } catch (err) {
      flag = false
    }

    if (flag) {
      //clientMap[key] = client
      return client;
    }

  }

  const folder = async (id) => {
    let resid = `${defaultProtocol}:${id}`
    let r = cache.get(resid)
    let resp = { id: id, type: 'folder', protocol: defaultProtocol }

    if (r) {
      resp = r
      if (
        resp.$cached_at &&
        resp.children &&
        (Date.now() - resp.$cached_at < getConfig('max_age_dir'))

      ) {
        console.log('get ftp folder from cache')
        return resp
      }
    }

    let client = await getClient(id)

    if (client) {
      let data = await client.list();

      //client.close()

      let children = [];

      data.forEach(i => {
        let path = (id + '/').replace(/\/{2,}$/g,'/') + i.name
        let obj = {
          id: path,
          name: i.name,
          protocol: defaultProtocol,
          size: i.size,
          created_at: i.date,
          updated_at: i.date,
          ext: extname(i.name),
          type: 'other'
        }
        /*
          Unknown = 0,
          File = 1,
          Directory = 2,
          SymbolicLink = 3
        */
        if (i.type == 2 || i.type == 3) {
          obj.type = 'folder'
        }

        children.push(obj)
      })

      resp.$cached_at = Date.now()
      resp.children = children
      cache.set(resid, resp)

      return resp
    } else {
      return false
    }
  }

  const file = async (id) => {
    console.log(id)
    let client = await getClient(id , true)
    let resp = {
      id,
      name: path.basename(id),
      ext: extname(id),
      url: id,
      protocol: defaultProtocol,
      outputType: 'stream',
      proxy: true
    }

    let file = id.split('/').pop()

    if (client) {
      let size = await client.size(file)
      resp.size = size
      //client.close()
    }

    return resp
  }

  const stream = async (id, options = {}) => {
    let client = await getClient(id, true)
    let file = id.split('/').pop()
    let startAt = (options && options.range && options.range.start) ? options.range.start : 0;
    if (client) {
      let dest = new PassThrough()
      client.download(dest, file)
      return { 
        stream: dest,
        acceptRanges:false
      }
    } else {
      return null
    }
  }

  return { name, version, drive: { protocols, folder, file, stream } }
}
