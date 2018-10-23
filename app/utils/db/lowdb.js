const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
// const lodashId = require('lodash-id')
const adapter = new FileSync(process.cwd()+'/cache/db.json')
const db = low(adapter)

db._.mixin({
  record : function(collection , predicate , key, data , limit){
    let doc = this.find(collection , predicate)
    let arr = doc[key]
    if(arr){
      let count = arr.length
      arr.push(data)
      if(arr.length >= limit){
        arr.splice(0,Math.round(limit / 5))
      }
    }

    return arr
  },
  pickout : function(array , predicate){
    let index = -1
    const length = array == null ? 0 : array.length
    const result = new Array(length)
    
    while (++index < length) {
      let o = {}
      for(let key in array[index]){
        if(key != predicate) o[key] = array[index][key]
      }
      result[index] = o
    }
    return result
  }
})

db.defaults({ hash: {} }).write()

module.exports = db