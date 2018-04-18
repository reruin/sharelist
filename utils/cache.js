const db = require('./../utils/db/lowdb')

var _cache = db.get('hash').value()

function cache(key , ...rest){
  if(rest.length){
    _cache[key] = rest[0]
    db.set('hash' , _cache).write()
  }else{
    return _cache[key]
  }
}

cache.clear = () =>{
  _cache = {}
  db.set('hash' , {}).write()
}

module.exports = cache