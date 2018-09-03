const decode = require('./format').decode

const rnd = (min , max) => Math.floor(min+Math.random()*(max-min))

const isType = (type) => (obj) => ( Object.prototype.toString.call(obj) === `[object ${type}]`)

const isArray = isType('Array')

const isObject = isType('Object')

const isString = isType('String')

const parse_path = (url)=>{
  if(url){
    let raw = url.split('/')
    let paths = []
    for(let i = 0 ; i< raw.length ; i++){
      if( i == 0 || /[^!]$/.test(raw[i-1]) ){
        paths.push(decode(raw[i].replace(/!$/,'')))
      }
    }
    // let paths = raw.filter((i)=>(!/^!/.test(i)))
    return [paths , raw]
  }else{
    return [[] , []]

  }
}

const checkPasswd = (data)=>{
  let passwd = false
  if(data.children){
    let hit = data.children.find(i=>(i.ext == 'passwd'))
    if(hit){
      passwd = hit.name.replace('.passwd','').split('.').slice(-1)
    }
  }
  return passwd
}


function isFolder(v){
  if(v === 'xd'){
    return true
  }
}

module.exports = {
  parse_path , checkPasswd , isFolder , isArray , isObject, 
  extend(source , src){
    for(var i in src){
      source[i] = src[i]
    }
    return source
  },
  hash(d , key){
    let ret = {}
    d.forEach((i)=>{
      ret[i[key]] = i
    })
    return ret
  },

  isEmail(v){
  	return /^[A-Za-zd]+([-_.][A-Za-zd]+)*@([A-Za-zd]+[-.])+[A-Za-zd]{2,5}$/.test(v)
  },

  ip(){
    return rnd(50,250) + "." + rnd(50,250) + "." + rnd(50,250)+ "." + rnd(50,250);  
    
  },

  base64_encode(v){
    return new Buffer(v).toString('base64').replace(/\//g,'_')
  },

  base64_decode(v){
    return new Buffer(v.replace(/_/g,'/'), 'base64').toString()
  },

  params (url){
    url = url.split('?')[1]
    let reg = /(?:&)?([^=]+)=([^&]*)/ig,
    obj = {},
    m

    while(m = reg.exec(url)) obj[m[1]] = m[2]

    return obj
  },

  search(ret , key , value){
    for(let i in ret){
      if(ret[i][key] == value){
        return i
      }
    }
    return -1
  },

  mime_type(v){
    if(['mp4' , 'mpeg' , 'wmv' , 'webm' , 'avi' , 'rmvb' , 'mov' , 'mkv','f4v','flv'].indexOf(v) >= 0){
      return 'video'
    }
    else if(['mp3' , 'm4a' ,'wav' ,'wma', 'ape' , 'flac' , 'ogg'].indexOf(v)>=0){
      return 'audio'
    }
    else if(['doc', 'docx','ppt','pptx','xls','xlsx','pdf','txt'].indexOf(v)>=0){
      return 'doc'
    }
    else if(['jpg','jpeg','png','gif','bmp','tiff'].indexOf(v) >= 0){
      return 'image'
    }
    else{
      return 'other'
    }
  },

  path(path){
      // see https://github.com/seajs/seajs/blob/master/src/util-path.js
      let DOUBLE_DOT_RE = /\/[^\/]+\/\.\.\//,
          basepath = ''

      path = path
          .replace(/\/\.\//g, "/") // /./ => /
          .replace(/([^:\/])\/+\//g,"$1/"); //  a//b/c ==> a/b/c
      // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
      while (path.match(DOUBLE_DOT_RE)) {
          path = path.replace(DOUBLE_DOT_RE, "/");
      }
      return path;
  }
}