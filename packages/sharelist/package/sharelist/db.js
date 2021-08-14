const path = require('path')
const os = require('os')
const fs = require('fs')
const writeFileAtomic = require('write-file-atomic')
const { reactive, watch } = require('./reactivity')

const mkdir = function (p) {
  if (fs.existsSync(p) == false) {
    mkdir(path.dirname(p))
    fs.mkdirSync(p)
  }
}

const base64 = {
  encode: (v) => Buffer.from(v).toString('base64'),
  decode: (v) => Buffer.from(v, 'base64').toString(),
}

const merge = function (dst, src) {
  for (let key in src) {
    if (!(key in dst)) {
      dst[key] = src[key]
      continue
    } else {
      if (typeof src[key] == 'object' || Array.isArray(src[key])) {
        merge(dst[key], src[key])
      } else {
        dst[key] = src[key]
      }
    }
  }
  return dst
}

const getData = (path, options) => {
  try {
    let data = fs.readFileSync(path, 'utf8')

    if (!options.raw) {
      data = base64.decode(data)
    }

    return JSON.parse(data)
  } catch (error) {
    //if it doesn't exist or permission error
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      return {}
    }

    //invalid JSON
    if (error.name === 'SyntaxError') {
      writeFileAtomic.sync(path, '')
      return {}
    }

    throw error
  }
}

const setData = (filepath, { raw }, value) => {
  try {
    mkdir(path.dirname(filepath))

    value = JSON.stringify(value)
    if (!raw) {
      value = base64.encode(value)
    }

    writeFileAtomic.sync(filepath, value)
  } catch (error) {
    //throw error;
  }
}

const createdb = (path, { raw, shallow } = { raw: false, shallow: false }, defaults = {}) => {
  let data = merge(defaults, getData(path, { raw }))

  const save = () => setImmediate(() => setData(path, { raw }, data))

  const db = reactive(data, shallow)

  watch(
    () => db,
    () => {
      save()
    },
    { deep: true },
  )

  return db
}

module.exports = createdb
