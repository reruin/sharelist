/**
 * Mount file system
 */

const path = require('path')
const fs = require('fs')
const os = require('os')

const isWinOS = os.platform() == 'win32'

/**
 * Convert posix style path to windows style
 * 
 * @param {string} [p]
 * @return {string}
 */
const winStyle = (p) => p.replace(/^\/([^\/]+?)/, '$1:\\').replace(/\//g, '\\').replace(/(?<!\:)\\+$/, '').replace(/\\{2,}/g, '\\')

/**
 * Convert windows style path to posix style
 * 
 * @param {string} [p]
 * @return {string}
 */
const posixStyle = (p) => p.split('\\').join('/').replace(/^([a-z])\:/i,'/$1')

/**
 * normalize path(posix style) and replace current path
 * 
 * @param {string} [p]
 * @return {string}
 */
const normalize = (p) => path.posix.normalize(p.replace(/^\.\//, slpath(process.cwd()) + '/'))

const slpath = (p) => (isWinOS ? posixStyle(p) : p)

const realpath = (p) => (isWinOS ? winStyle(p) : p)


class FileSystem {
  constructor() {
    this.name = 'FileSystem'
    this.label = '本地文件'
    this.mountable = true
    this.cache = false

    this.version = '1.0'
    this.protocol = 'fs'
  }

  mkdir(p) {
    if (fs.existsSync(p) == false) {
      this.mkdir(path.dirname(p));
      fs.mkdirSync(p);
    }
  }

  path(id) {
    let { datetime, extname } = this.helper

    let { protocol } = this

    let dir = normalize(id)

    let realdir = realpath(dir)

    let stat = fs.statSync(realdir)

    if (stat.isDirectory()) {
      let children = []
      fs.readdirSync(realdir).forEach((filename) => {
        let path = normalize(dir + '/' + filename)
        let stat
        try {
          stat = fs.statSync(realpath(path))
        } catch (e) {}

        let obj = {
          id: path,
          name: filename,
          protocol: this.protocol,
          type: 'other'
        }

        if (stat) {
          obj.created_at = datetime(stat.ctime)
          obj.updated_at = datetime(stat.mtime)
          if (stat.isDirectory()) {
            obj.type = 'folder'
          } else if (stat.isFile()) {
            obj.ext = extname(filename)
            obj.size = stat.size
          }
        }
        children.push(obj)
      })

      return { id: dir, type: 'folder', protocol: this.protocol , children }

    } else if (stat.isFile()) {
      return {
        id,
        name: path.basename(id),
        protocol: this.protocol,
        ext: extname(id),
        url: realpath(id),
        size: stat.size,
        outputType: 'file',
        proxy: true
      }
    } else {
      return false
    }

  }

  folder(id) {
    return this.path(id)
  }

  file(id) {
    return this.path(id)
  }

  async createReadStream({ id, options = {} } = {}) {
    return fs.createReadStream(realpath(id), { ...options, highWaterMark: 64 * 1024 })
  }

  async createWriteStream({ id, options = {}, target = '' } = {}) {
    let fullpath = path.join(id , target)
    let parent = (fullpath.split('/').slice(0, -1).join('/') + '/').replace(/\/+$/g, '/')
    this.mkdir(parent)
    return fs.createWriteStream(realpath(fullpath), options)
  }
}


module.exports = FileSystem