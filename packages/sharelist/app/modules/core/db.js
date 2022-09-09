const path = require('path')

const fs = require('fs')

const writeFileAtomic = require('write-file-atomic')

const { watch } = require('@vue-reactivity/watch')

const { reactive } = require('@vue/reactivity')

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

const getData = (path, options = {}) => {
  try {
    let data = fs.readFileSync(path, 'utf8')

    if (options.base64) {
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

const setData = (filepath, { base64 } = {}, value) => {
  try {
    mkdir(path.dirname(filepath))

    value = JSON.stringify(value)
    if (base64) {
      value = base64.encode(value)
    }

    writeFileAtomic.sync(filepath, value)
  } catch (error) {
    //throw error;
  }
}

const createdb = (path, { autoSave, debug } = { autoSave: false }, defaults = {}) => {
  let data = merge(defaults, getData(path))

  let handler
  const save = (nv) => {
    if (debug) console.log('db changed', nv)
    if (handler) {
      clearImmediate(handler)
    }

    handler = setImmediate(() => {
      setData(path, {}, nv || data)
      handler = null
    })
  }

  if (autoSave) {
    data = reactive(data)
    watch(data, save, { deep: true })
  }

  return { data, save }
}

module.exports = createdb
