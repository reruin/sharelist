/**
 * SFTP
 */

const { PassThrough } = require('stream')

const SFTPClient = require('ssh2-sftp-client');

const { URL } = require("url")

const CLOSED = Symbol('client_closed')

class SFTP {
  constructor() {
    this.name = 'sftp'
    this.label = 'SFTP'
    this.mountable = true
    this.cache = false

    this.version = '1.0'
    this.protocol = 'sftp'

    this.clientMap = {}
  }

  async getClient (url, cd = false) {
    let { clientMap } = this
    let key = (url.match(/\/\/[\w\W]+?\//) || [''])[0];
    let { username, password, hostname, port, pathname } = new URL(url);

    if (clientMap[key] && clientMap[key][CLOSED] !== true) {
      return { client : clientMap[key] , path:pathname }
    } 

    let client = new SFTPClient();

    let options = {
      host:hostname
    }
    if(port) options.port = port
    if( username && password) {
      options.username = decodeURIComponent(username)
      options.password = decodeURIComponent(password)
    }

    try {
      await client.connect( options )
      client.on('close' , () => {
        client[CLOSED] = true
      })
      clientMap[key] = client
      return { client , path:pathname }
    } catch (err) {
      console.log(err)
      return { }
    }

  }

  createId(parent , current){
    return parent.replace(/\/$/,'') +  '/' + current
  }

  async folder(id) {
    let { datetime, extname , getConfig , cache } = this.helper

    let { protocol } = this

    if(!id.startsWith(protocol)) id = protocol + ':' + id

    let { client , path } = await this.getClient(id)

    if (client) {
      let data = await client.list(path);

      let children = data.map(i => {
        let obj = {
          id: this.createId(id , i.name),
          name: i.name,
          protocol,
          size: i.size,
          created_at: null,
          updated_at: datetime(i.modifyTime),
          ext: extname(i.name),
          type: 'other'
        }
        /*
          d / l / -
        */
        if (i.type == 'd') {
          obj.type = 'folder'
        }

        return obj
      })

      return { id: id, type: 'folder', protocol , children }
    } else {
      return false
    }

  }


  async file(id) {
    let { basename , extname } = this.helper
    let { protocol } = this

    let { client , path } = await this.getClient(id)

    let resp = {
      id,
      ext: extname(id),
      url: id,
      protocol,
      outputType: 'stream',
      proxy: true
    }

    if(client){
      let info = await client.stat(path)
      resp.size = info.size
    }
    
    resp.name = id.split('/').pop()

    return resp
  }

  async createReadStream({id , size , options = {}} = {}) {
    let { client , path } = await this.getClient(id)

    let resp = {}
    if (client) {
      let dest = new PassThrough()
      let cfg = { autoClose:false }
      if(options.encoding){
        cfg.encoding = options.encoding
      }
      client.get(path, dest, cfg)
      return dest
    } else {
      return null
    }
  }

}


module.exports = SFTP