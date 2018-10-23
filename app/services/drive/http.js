/*
 * http 文件
 * id: file(folder) path
 */

const name = 'HTTPFile'

const version = '1.0'

const protocols = ['http','https']

const url = require("url")

module.exports = (format) => {

  const file = (id)=>{
    return {
      id,
      name:id.split('/').slice(0,-1),
      ext: id.split('.').slice(0,-1),
      url: id,
      provider:'http',
      protocol:id.split(':')[0]
    }
  }

  const folder = file

  return { name , version , protocols , folder , file }
}