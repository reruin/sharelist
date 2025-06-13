const createDB = require('./db')

module.exports = (path) => {
  let { data, save } = createDB(path)

  const get = (id) => {
    if (id === undefined) return data
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
    save()
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
    save()
  }

  const remove = (key) => {
    delete data[key]
    save()
  }

  // remove expired data
  for (let key in data) {
    get(key, data)
    save()
  }

  return {
    get, set, remove, clear, save
  }
}