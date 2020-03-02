/*
 * https
 */

const name = 'HTTPSFile'

const version = '1.0'

const protocols = ['https']

module.exports = ({wrapReadableStream , request}) => {

  const file = (id)=>{
    return {
      id,
      name:id.split('/').pop(),
      ext: id.split('.').pop(),
      url: `https:${id}`,
      protocol:'https',
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
    let url = encodeURI(`https:${id}`)
    let size = await getFileSize(url)
    console.log('get file size' , size)
    let readstream = request({url:decodeURIComponent(url), method:'get'})
    return wrapReadableStream(readstream , { size } )
  }

  return { name , version , drive:{ protocols , folder , file , createReadStream , mountable : false } }
}