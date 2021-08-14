const mimeParse = require('mime')

const YAML = require('yaml')

const isType = (type) => (obj) => Object.prototype.toString.call(obj) === `[object ${type}]`

const isArray = isType('Array')

const isObject = isType('Object')

const isString = isType('String')

const isDate = isType('Date')

exports.isClass = (fn) => typeof fn == 'function' && /^\s*class/.test(fn.toString())

exports.base64 = {
  encode: (v) => Buffer.from(v).toString('base64'),
  decode: (v) => Buffer.from(v, 'base64').toString(),
}

exports.btoa = (v) => Buffer.from(v).toString('base64')
exports.atob = (v) => Buffer.from(v, 'base64').toString()

exports.isFunction = (fn) => typeof fn == 'function'

const datetime = (exports.datetime = (date, expr = 'iso') => {
  var a = new Date()
  if (isDate(date)) {
    a = date
  } else if (isString(date)) {
    try {
      a = new Date(date)
    } catch (e) { }
  }

  var y = a.getFullYear(),
    M = a.getMonth() + 1,
    d = a.getDate(),
    D = a.getDay(),
    h = a.getHours(),
    m = a.getMinutes(),
    s = a.getSeconds()

  function zeroize(v) {
    v = parseInt(v)
    return v < 10 ? '0' + v : v
  }

  if (expr === 'iso') {
    return a.toISOString()
  } else if (expr == 'ms') {
    return a.getTime()
  }
  return expr.replace(/(?:s{1,2}|m{1,2}|h{1,2}|d{1,2}|M{1,4}|y{1,4})/g, function (str) {
    switch (str) {
      case 's':
        return s
      case 'ss':
        return zeroize(s)
      case 'm':
        return m
      case 'mm':
        return zeroize(m)
      case 'h':
        return h
      case 'hh':
        return zeroize(h)
      case 'd':
        return d
      case 'dd':
        return zeroize(d)
      case 'M':
        return M
      case 'MM':
        return zeroize(M)
      case 'MMMM':
        return ['十二', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一'][m] + '月'
      case 'yy':
        return String(y).substr(2)
      case 'yyyy':
        return y
      default:
        return str.substr(1, str.length - 2)
    }
  })
})

exports.byte = (v) => {
  if (v === undefined || v === null || isNaN(v)) {
    return '-'
  }

  let lo = 0

  while (v >= 1024) {
    v /= 1024
    lo++
  }

  return Math.floor(v * 100) / 100 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'][lo]
}

const byteMap = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15, EB: 1e18 }
exports.retrieveByte = (v) => {
  if (/[\d\.]+\s*(B|KB|MB|GB|TB|PB|EB|K|M|G|T|P|E)/.test(v)) {
    let num = parseFloat(v)
    let unit = (v.match(/(B|KB|MB|GB|TB|PB|EB|K|M|G|T|P|E)/) || [''])[0]

    if (unit && num) {
      if (!unit.endsWith('B')) unit += 'B'
      return num * (byteMap[unit] || 0)
    }
  }

  return 0
}

exports.extname = (p) => p.split('.').pop()

exports.filetype = (v) => {
  if (v) v = v.toLowerCase()
  if (['mp4', 'mpeg', 'wmv', 'webm', 'avi', 'rmvb', 'mov', 'mkv', 'f4v', 'flv'].includes(v)) {
    return 'video'
  } else if (['mp3', 'm4a', 'wav', 'wma', 'ape', 'flac', 'ogg'].includes(v)) {
    return 'audio'
  } else if (['doc', 'docx', 'wps'].includes(v)) {
    return 'word'
  } else if (['pdf'].includes(v)) {
    return 'pdf'
  } else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf', 'txt', 'yaml', 'ini', 'cfg'].includes(v)) {
    return 'doc'
  } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'wmf', 'tif'].includes(v)) {
    return 'image'
  } else if (['zip', 'rar', '7z', 'tar', 'gz', 'gz2'].includes(v)) {
    return 'archive'
  } else {
    return 'other'
  }
}

exports.mime = (v) => mimeParse.getType(v)

exports.timestamp = (v) => datetime(v, 'ms')

exports.fit = (src, filter) => {
  return Object.keys(filter).every((key) => filter[key] === src[key])
}

exports.useErrorHandle = (cb) =>
  Promise.resolve(cb())
    .then((data) => {
      return Promise.resolve({ data })
    })
    .catch((err) => {
      return Promise.resolve({ err })
    })

exports.videoQuality = (text) => {
  return (
    {
      LD: 480,
      SD: 576,
      HD: 720,
      FHD: 1080,
      QHD: 1440,
      UHD: 2160,
    }[text] || 1080
  )
}

exports.transfromStreamToString = (stream, encoding = 'utf-8') =>
  new Promise((resolve, reject) => {
    let str = ''
    stream.on('data', (chunk) => {
      str += chunk.toString(encoding)
    })

    stream.on('end', () => {
      console.log(str)
      resolve(str)
    })
  })

exports.yaml = YAML

exports.safeCall = async (fn, args = []) => {
  let res
  try {
    res = args ? await fn(...args) : await fn()
  } catch (err) {
    console.log(err)
  }
  return res
}

exports.createCache = () => {
  const data = {}
  const get = (id) => {
    let ret = data[id]
    if (ret) {
      if (Date.now() > ret.expired_at) {
        delete data[id]
      } else {
        return ret.data
      }
    }
  }

  const set = (id, value, max_age) => {
    data[id] = { data: value, expired_at: Date.now() + max_age }
    return value
  }

  const clear = () => {
    for (let key in data) {
      delete data[key]
    }
  }

  for (let key in data) {
    get(key, data)
  }

  return {
    get, set, clear
  }
}

