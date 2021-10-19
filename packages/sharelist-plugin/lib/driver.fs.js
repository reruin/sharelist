/**
 * Mount file system
 */

const { basename, dirname, posix, resolve, join, parse } = require('path')
const fs = require('fs')
const os = require('os')
const { pipeline } = require('stream')
const { resolve4 } = require('dns')

const isWinOS = os.platform() == 'win32'

const pipe = (...rest) => new Promise((resolve, reject) => pipeline(...rest, (err) => err ? reject({ message: 'The error occurred during pipe stream' }) : resolve()))

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

const ERROR_CODE = {
  'EBUSY': 423,
}

const fileStat = (src) => {
  try {
    return fs.statSync(src)
  } catch (e) { }
}

const move = async (src, dst, { overwrite, copy, recursive } = { overwrite: false, copy: false, recursive: false }) => {
  const srcStats = await fileStat(src)
  console.log(srcStats)
  if (!srcStats) throw { code: 404 }

  let srcName = basename(src), dstName = basename(dst)

  // src is folder
  if (srcStats.isDirectory()) {
    const dstStats = await fileStat(dst)

    //dst is NOT exist
    if (!dstStats) {
      //check dst parent
      let dstParentStats = await fileStat(dirname(dst))
      //dst parent is not exist
      if (!dstParentStats) throw { code: 404 }

      //src is folder & dst is NOT exist & dst parent is folder , rename src
      if (dstParentStats.isDirectory()) {
        fs.renameSync(src, dst)
      } else {
        // dst parent is NOT a folder
        throw { code: 409 }
      }

    }
    // dst is exist
    else {
      // src is folder & dst is folder, move src into dst folder with its name
      if (dstStats.isDirectory()) {

        // TODO check same folder in dst
        fs.renameSync(src, join(dst, srcName))
      }
      // src is folder & dst is NOT a folder
      else {
        throw { code: 409 }
      }
    }
  }
  // src is not folder
  else {
    const dstStats = await fileStat(dst)

    // dst is not exist
    if (!dstStats) {
      let dstParentStats = await fileStat(dirname(dst))
      //dst parent is not exist
      if (!dstParentStats) throw { code: 404 }

      //src is folder & dst is NOT exist & dst parent is folder , rename src
      if (dstParentStats.isDirectory()) {
        fs.renameSync(src, dst)
      } else {
        // dst parent can't be a file
        throw { code: 409 }
      }
    } else {
      // src is file & dst is folder, move src into dst folder with its name
      if (dstStats.isDirectory()) {
        // TODO check same folder in dst
        fs.renameSync(src, join(dst, srcName))
      }
      // src is file & dst is NOT a folder , check override 
      else {
        if (!override) {
          throw { code: 409 }
        } else {
          fs.renameSync(src, dst)
        }
      }
    }
  }
}

const createError = (e) => {
  console.log(e)
  let error = { message: e.code }
  if (ERROR_CODE[e.code]) {
    error.code = ERROR_CODE[e.code]
  }
  return { error }
}

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

  async list(id) {

    let filepath = ospath(id)

    let stat = fs.statSync(filepath)

    if (stat.isDirectory()) {
      const files = []
      fs.readdirSync(filepath).forEach((filename) => {
        let dir = normalize(id + '/' + filename)
        let stat
        try {
          stat = fs.statSync(ospath(dir))
        } catch (e) {
          // console.log(e)
        }

        let obj = {
          id: dir,
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
          obj.extra = {
            fid: dir,
            parent_id: id
          }
        }
        files.push(obj)
      })
      return files
    }

    return this.app.error({ message: 'path is not exist' })
  }

  async get(id) {
    let stat = fileStat(ospath(id))
    if (!stat) return this.app.error({ code: 404 })
    return {
      id: id,
      name: basename(id),
      size: stat.size,
      type: stat.isDirectory() ? 'folder' : 'file',
      ctime: stat.ctimeMs,
      mtime: stat.mtimeMs,
      extra: {
        fid: id,
        parent_id: dirname(id)
      }
    }
  }

  mkdir(id, name) {
    let filepath = ospath(id)
    let target = join(filepath, name)

    if (fs.existsSync(target) == false) {
      fs.mkdirSync(target)
    }

    return { id: normalize(id + '/' + name), name }
  }

  rm(id) {
    let filepath = ospath(id)
    try {
      fs.rmSync(filepath, { force: false, recursive: true })
    } catch (e) {
      console.log(e)
      return createError(e)
    }
    return { id }
  }

  rename(id, name) {
    let filepath = ospath(id)
    let dir = dirname(filepath)
    let targetpath = join(dir, name)
    try {
      fs.renameSync(filepath, targetpath)
    } catch (e) {
      console.log(e)
      return createError(e)
    }

    return { id: `${dir + '/' + name}`, name }
  }

  /**
   * move
   * @param {*} id file or folder ID
   * @param {string} target folder ID
   * @returns 
   */
  async mv(id, target) {

    let filepath = ospath(this.parsePath(id))
    let targetpath = ospath(this.parsePath(target))

    let dst = join(targetpath, basename(id))

    try {
      fs.renameSync(filepath, dst)
    } catch (e) {
      return createError(e)
    }

    return { id: dst }
  }

  async upload(id, { size, name, stream, ...options }) {
    let filepath = ospath(id)
    let target = join(filepath, name)
    let writeStream = fs.createWriteStream(target, options)
    await pipe(stream, writeStream)
    return { id: id + '/' + name, name }
  }

  async createReadStream(id, options = {}) {
    let filepath = ospath(this.parsePath(id))
    return fs.createReadStream(filepath, { ...options, highWaterMark: 64 * 1024 })
  }
}

module.exports = FileSystem
