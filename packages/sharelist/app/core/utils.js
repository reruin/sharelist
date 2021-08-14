const path = require('path')

const isType = (type) => (obj) => (Object.prototype.toString.call(obj) === `[object ${type}]`)

exports.isArray = isType('Array')

exports.isObject = isType('Object')

exports.isString = val => typeof val === 'string'

exports.isDate = isType('Date')

exports.each = (obj, callback) => {
  let ret = {}
  for (let i in obj) {
    ret[i] = callback(obj[i], i)
  }
  return ret
}

exports.isClass = fn => typeof fn == 'function' && /^\s*class/.test(fn.toString())

exports.base64 = {
  encode: (v) => Buffer.from(v).toString('base64'),
  decode: (v) => Buffer.from(v, 'base64').toString()
}

exports.atob = v => Buffer.from(v, 'base64').toString()
exports.btoa = v => Buffer.from(v).toString('base64')

exports.isFunction = (fn) => typeof fn == 'function'

exports.pathNormalize = (p, basepath = '') => path.posix.normalize(p);

exports.isRelativePath = (v) => !/^http/.test(v)
