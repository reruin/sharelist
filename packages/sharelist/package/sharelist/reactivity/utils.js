const { isMap, isSet, isProxy } = require('util').types

exports.isObject = v => v !== null && typeof v === 'object'

exports.isArray = v => Array.isArray(v)

exports.isFunction = val => typeof val === 'function'

exports.isString = val => typeof val === 'string'

exports.isPlainObject = val => Object.prototype.toString.call(val) === '[object Object]'

exports.isIntegerKey = (key) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key

exports.hasChanged = (value, oldValue) => value !== oldValue && (value === value || oldValue === oldValue)

exports.hasOwnProperty = Object.prototype.hasOwnProperty

exports.hasOwn = (val, key) => hasOwnProperty.call(val, key)

exports.isMap = isMap

exports.isSet = isSet

exports.isProxy = isProxy
