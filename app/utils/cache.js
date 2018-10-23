const db = require('./../utils/db/lowdb')

const { isString , isArray, isObject } = require('../utils/base')

var _cache = db.get('hash').value()

function cache(key , ...rest){
  if(rest.length){
    _cache[key] = rest[0]
    db.set('hash' , _cache).write()
  }else{
    return _cache[key]
  }
}

cache.get = (key , deep = false) => {
  let ret = _cache[key]
  while(isString(ret) && _cache[ret] && deep){
    ret = _cache[ret]
  }
  return (isArray(ret) || isObject(ret)) ? ret : undefined
}

cache.clear = (key) =>{
  if(key){
    delete _cache[key]
  }else{
    _cache = {}
  }
  db.set('hash' , _cache).write()
}

cache.save = () =>{
  db.set('hash' , _cache).write()
}

module.exports = cache