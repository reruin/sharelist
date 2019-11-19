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
      protocol:'https'
    }
  }

  const folder = file

  const getFileSize = async (url) => {
    let size = null
    try{
      let nh = await request.header(url)
      if(nh && nh['content-length']){
        size = nh['content-length']
      }
    }catch(e){
      console.log(e) 
    }
    return size
  }

  const createReadStream = async ({id , options = {}} = {}) => {
    let url = `http:${id}`
    let size = await getFileSize(url)
    let readstream = request({url, method:'get'})
    console.log('>>>',url,size)

    return wrapReadableStream(readstream , { size: size } )
  }
  return { name , version , drive:{ protocols , folder , file , createReadStream , mountable : false} }
}