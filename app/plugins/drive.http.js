/*
 * http
 */

const name = 'HTTPFile'

const version = '1.0'

const protocols = ['http']

module.exports = ({wrapReadableStream , request}) => {

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

  const getFileSize = async (url , headers) => {
    try{
      let nh = await request.header(decodeURIComponent(url) , {headers})
      if(nh && nh['content-length']){
        return nh['content-length']
      }else{
        return null
      }
    }
    catch(e){
      return null
    }
  }

  const createReadStream = async ({id , options = {}} = {}) => {
    let url = encodeURI(`http:${id}`)
    let size = await getFileSize(url)
    console.log('get file size' , size)
    let readstream = request({url:decodeURIComponent(url), method:'get'})
    return wrapReadableStream(readstream , { size } )
  }

  return { name , version , drive:{ protocols , folder , file , createReadStream , mountable : false } }
}