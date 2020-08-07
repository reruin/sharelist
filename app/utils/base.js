const mime = require('mime')

const path = require('path')

const crypto = require('crypto')

const md = require('markdown-it')()

const parseXML = require('xml2js').parseString

const rnd = (min, max) => Math.floor(min + Math.random() * (max - min))

const isType = (type) => (obj) => (Object.prototype.toString.call(obj) === `[object ${type}]`)

const isArray = isType('Array')

const isObject = isType('Object')

const isString = isType('String')

const isDate = isType('Date')

const isEmail = (v) => /^[A-Za-zd]+([-_.][A-Za-zd]+)*@([A-Za-zd]+[-.])+[A-Za-zd]{2,5}$/.test(v)

const parsePath = (url) => {
  if (url) {
    let raw = url.replace(/^\/*/, '').split('/')
    let paths = []
    for (let i = 0; i < raw.length; i++) {
      if (i == 0 || /[^!]$/.test(raw[i - 1])) {
        paths.push(decodeURIComponent(raw[i]))
      }
    }
    return [paths, raw]
  } else {
    return [
      [],
      []
    ]
  }
}

const getFileType = (v) => {
  if(v) v = v.toLowerCase()
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

const getMIME = (v) => {
  return mime.getType(v)
}

const extend = (source, src) => {
  for (var i in src) {
    source[i] = src[i]
  }
  return source
}

const hash = (d, key) => {
  let ret = {}
  d.forEach((i) => {
    ret[i[key]] = i
  })
  return ret
}


const getRandomIP = () => (rnd(50, 250) + "." + rnd(50, 250) + "." + rnd(50, 250) + "." + rnd(50, 250))

const search = (ret, key, value) => {
  for (let i in ret) {
    if (ret[i][key] == value) {
      return i
    }
  }
  return -1
}

const pathNormalize = (path , basepath = '') => {
  // see https://github.com/seajs/seajs/blob/master/src/util-path.js
  let DOUBLE_DOT_RE = /\/[^\/]+\/\.\.\/?/

  if( path.charCodeAt(0) != 47 && basepath){
    path = basepath + '/' +path
  }

  path = path
      .replace(/\/\.\//g, "/") // /./ => /
      .replace(/\/+/g,"/") //  // ==> /
  // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
  while (path.match(DOUBLE_DOT_RE)) {
    path = path.replace(DOUBLE_DOT_RE, "/");
  }

  path = path.replace(/\/\.+\//g,'/')
  path = path == '/' ? path : path.replace(/\/$/,'')

  return path;
}

const base64 = {
  encode: (v) => Buffer.from(v).toString('base64'),
  decode: (v) => Buffer.from(v, 'base64').toString()
}

const enablePreview = (v) => ['audio', 'video', 'image'].includes(v)

const enableRange = (v) => ['audio', 'video'].includes(v)

const isRelativePath = (v) => !/^http/.test(v)

// const extname = (p) => path.extname(p).substring(1)

const extname = (p) => p.split('.').pop()

const markdownParse = (v) => md.render(v)

const md5 = (v) => {
  return crypto.createHash('md5').update(v).digest('hex')
}

const { StringDecoder } = require('string_decoder');

const parseStream = (stream , encoding = 'utf-8') => new Promise((resolve , reject) => {
  let str = ''
  const decoder = new StringDecoder(encoding);
  stream.on('data' , (chunk) => {
    str += decoder.write(chunk);
  })

  stream.on('end' , () => {
    resolve(str)
  })
})

const xml2json = ( xml , options = {}) => {
  return new Promise((resolve , reject) => {
    parseXML(xml, options, (err, res) => {
      if (err) resolve(null)
      else resolve(res)
    })
  })
}

module.exports = {
  parsePath,
  getFileType,
  getMIME,

  isArray,
  isObject,
  isString,
  isDate,
  isEmail,
  isRelativePath,
  enablePreview,
  enableRange,

  hash,
  extend,
  getRandomIP,
  pathNormalize,
  search,
  base64,
  extname,
  markdownParse,
  md5,
  parseStream,
  xml2json,
  params(url) {
    url = url.split('?')[1]
    let reg = /(?:&)?([^=]+)=([^&]*)/ig,
      obj = {},
      m

    while (m = reg.exec(url)) obj[m[1]] = m[2]

    return obj
  }

}
