const createDB = require('./db')
module.exports = (path) => {
  let data = createDB(path, { raw: true, shallow: true })

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

  const clear = (key) => {
    if (key) {
      delete data[key]
    } else {
      for (let key in data) {
        delete data[key]
      }
    }
  }

  const remove = (key) => {
    console.log('remove', key)
    delete data[key]
  }

  // remove expired data
  for (let key in data) {
    get(key, data)
  }

  return {
    get, set, remove, clear
  }
}