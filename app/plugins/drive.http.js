/*
 * http
 */

const name = 'HTTPFile'

const version = '1.0'

const protocols = ['http']

module.exports = (format) => {

  const file = (id)=>{
    return {
      id,
      name:id.split('/').pop(),
      ext: id.split('.').pop(),
      url: `http:${id}`,
      protocol:'http',
    }
  }

  const folder = file

  return { name , version , drive:{ protocols , folder , file , mountable : false } }
}