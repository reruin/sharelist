/*
 * Openload(openload.co)
 * openload:APILogin:APIKey@
 * 
 * Deprecated 无法实现图片验证码识别
 */

const name = 'Openload(Deprecated)'

const version = '1.0'

const protocols = ['openload']

const defaultProtocol = 'openload'

const host = 'https://api.openload.co/1'

module.exports = ({ request , getConfig , datetime , cache }) => {

  const parse = (id) => {
    let tmp = id.split('@')
    let login , key , fid
    if( tmp[0] ){
      let pairs = tmp[0].split(':')
      login = pairs[0]
      key = pairs[1]
    }
    if( tmp[1] ){
      fid = tmp[1]
    }

    return { login , key , id : fid }
  }

  const http = (url , params) => request.get(`${host}${url}` , {qs:params , json:true})

  const folder = async(id) => {
    let resid = `${defaultProtocol}:${id}`
    let resp = false
    let r = cache.get(resid)
    if(r) {
      resp = r
      if(
        resp.$cached_at && 
        resp.children &&
        ( Date.now() - resp.$cached_at < getConfig('max_age_dir'))

      ){
        console.log('get folder from cache')
        return resp
      }
    }

    let params = parse(id)
    let children = []
    if(params.login && params.key){
      let pairs = `${params.login}:${params.key}@`
      let opts = { login : params.login , key : params.key }
      if( params.id ){
        opts.folder = params.id
      }
      let { body } = await http(`/file/listfolder` ,  opts)

      if( body.status == 200 ){
        resp = {id , type:'folder' , protocol:defaultProtocol}
        body.result.folders.forEach( i => {
          children.push({
            id:pairs+i.id,
            name:i.name,
            protocol:defaultProtocol,
            type:'folder'
          })
        })

        body.result.files.forEach( i => {
          children.push({
            id:pairs+i.linkextid,
            name:i.name,
            ext:i.name.split('.').pop(),
            protocol:defaultProtocol,
            parent:pairs+i.folderid,
            mime:i.content_type,
            created_at:datetime(i.upload_at*1000),
            updated_at:datetime(i.upload_at*1000),
            size:parseInt(i[13]),
            type : undefined,
          })
        })

        //folder 额外保存 
        resp.children = children
        resp.$cached_at = Date.now()

        cache.set(resid,resp)
      }
    }

    return resp
  }

  /**
   * 获取文件实际路径
   */
  const file = async(id , data = {}) =>{
    
    let params = parse(id)
    // preparing a Download
    let { body } = await http(`/file/dlticket` , {login : params.login , key : params.key , file:params.id})
    if( body.status == 200 ){
      let resp = await http(`/file/dl`,{file:params.id , ticket: body.result.ticket ,captcha_response:body.result. captcha_response} )
      body = resp.body

      if( body.status == 200 ){
        data.url = body.result.url
      }
    }
    return data
  }

  return { name , version, drive:{ protocols, folder , file } }
}