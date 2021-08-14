/**
 * Mount file system
 */

const { basename, posix, resolve } = require('path')
const fs = require('fs')
const os = require('os')

const isWinOS = os.platform() == 'win32'

/**
 * Convert posix style path to windows style
 *
 * @param {string} [p]
 * @return {string}
 */
const winStyle = (p) =>
  p
    .replace(/^\/([^\/]+?)/, '$1:\\')
    .replace(/\//g, '\\')
    .replace(/(?<!\:)\\+$/, '')
    .replace(/\\{2,}/g, '\\')

/**
 * Convert windows style path to posix style
 *
 * @param {string} [p]
 * @return {string}
 */
const posixStyle = (p) =>
  p
    .split('\\')
    .join('/')
    .replace(/^([a-z])\:/i, '/$1')

/**
 * normalize path(posix style) and replace current path
 *
 * @param {string} [p]
 * @return {string}
 */
const normalize = (p) => posix.normalize(p.replace(/\.\//, slpath(process.cwd()) + '/'))

const slpath = (p) => (isWinOS ? posixStyle(p) : p)

const ospath = (p) => (isWinOS ? winStyle(p) : p)

const parseRelativePath = (p) => p.replace(/\.\//, slpath(process.cwd()) + '/')
// let stat = fs.statSync('D:\CloudMusic\Falcom Sound Team jdk - 浮游大陆アルジェス -Introduction-.mp3')
// console.log(stat)

class FileSystem {
  constructor(app) {
    this.name = 'LocalFile'
    this.label = '本地文件'
    this.mountable = true
    this.cache = false

    this.version = '1.0'
    this.protocol = 'file'

    this.guide = [
      { key: 'path', label: '目录地址', type: 'string', required: true },
      // { key: 'key', label: '相对目录', type: 'string', value: '', options: [{ value: '', label: '否' }, { value: '.', label: '是' }], required: false },
    ]
  }

  onReady(app) {
    this.app = app
  }

  encode(data) {
    return `${this.protocol}://${data.path}`
  }

  decode(id) {
    let p = id.replace(`${this.protocol}://`, '').replace(/^\/+/, '/')

    if (p.startsWith('/.')) p = parseRelativePath(p.substring(1))

    return { protocol: this.protocol, path: p }
  }

  parsePath(p) {
    return this.decode(p)?.path
  }

  mkdir(p) {
    if (fs.existsSync(p) == false) {
      this.mkdir(path.dirname(p))
      fs.mkdirSync(p)
    }
  }

  rm(p) {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p)
    }
  }

  async list(id) {
    let path = this.parsePath(id)

    let filepath = ospath(path)

    let stat = fs.statSync(filepath)

    if (stat.isDirectory()) {
      const files = []
      fs.readdirSync(filepath).forEach((filename) => {
        let dir = normalize(path + '/' + filename)
        let stat
        try {
          stat = fs.statSync(ospath(dir))
        } catch (e) {
          // console.log(e)
        }

        let obj = {
          fid: dir,
          id: `${this.protocol}://${dir}`,
          name: filename,
        }
        if (stat) {
          if (stat.isDirectory()) {
            obj.type = 'folder'
          } else if (stat.isFile()) {
            obj.type = 'file'
            obj.size = stat.size
          }
          obj.ctime = stat.ctimeMs
          obj.mtime = stat.mtimeMs
        }
        files.push(obj)
      })

      return { id, files }
    }

    return { error: { message: 'path is not exist' } }
  }

  async get(id) {
    let path = this.parsePath(id)

    let stat = fs.statSync(ospath(path))

    return {
      fid: path,
      id: id,
      name: basename(path),
      size: stat.size,
      type: 'file',
      ctime: stat.ctimeMs,
      mtime: stat.mtimeMs,
    }
  }

  async createReadStream(id, options = {}) {
    let filepath = ospath(this.parsePath(id))
    return fs.createReadStream(filepath, { ...options, highWaterMark: 64 * 1024 })
  }

  async createWriteStream({ id, options = {}, target = '' } = {}) {
    let fullpath = path.join(id, target)
    let parent = (fullpath.split('/').slice(0, -1).join('/') + '/').replace(/\/+$/g, '/')
    this.mkdir(parent)
    return fs.createWriteStream(ospath(fullpath), options)
  }
}

module.exports = FileSystem
