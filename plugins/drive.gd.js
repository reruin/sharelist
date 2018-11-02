/*
 * Google Drive
 * gd:GoogleDriveID
 */

const name = 'GoogleDrive'

const version = '1.0'

const protocols = ['gd','googledrive']

const defaultProtocol = 'gd'

const host = 'https://drive.google.com'

module.exports = ({ request , getConfig , datetime , cache }) => {

  // gd folder => files
  const folder = async(id) => {
    let resid = `${defaultProtocol}:${id}`
    let resp = {id , type:'folder' , protocol:defaultProtocol}
    let r = cache(resid)
    if(r) {
      resp = r
      if(
        resp.updated_at && 
        resp.children &&
        ( Date.now() - resp.updated_at < getConfig().cache_refresh_dir)

      ){
        console.log('get gd folder from cache')
        return resp
      }
    }


    let { body } = await request.get(host+'/drive/folders/'+id)
    let code = (body.match(/window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'/) || ['',''])[1]
    let data = code.replace(/\\x22/g,'"').replace(/\\x27/g,"'").replace(/\\x5b/g,'[').replace(/\\x5d/g,']').replace(/\\(r|n)/g,'').replace(/\\\\u/g,'\\u').toString(16)
    // console.log(data)

    if(data){
      try{
        data = JSON.parse(data)
        if(data.length){
          data = data[0]
        }
      }catch(e){
        data = []
      }
    }

    let children = data ? data.map((i)=>{
      return {
        id:i[0],
        name:i[2],
        ext:i[44],
        protocol:defaultProtocol,
        parent:i[1][0],
        mime:i[3],
        created_at:datetime(i[9]),
        updated_at:datetime(i[10]),
        size:parseInt(i[13]),
        type : i[3].indexOf('.folder')>=0  ? 'folder' : undefined,
      }
    }) : []


    //folder 额外保存 
    resp.children = children
    resp.updated_at = Date.now()

    cache(resid,resp)
    return resp
  }

  /**
   * 获取文件实际路径
   */
  const file = async(id , data = {}) =>{
    if(
      data && 
      data.url_updated && 
      data.url &&
      ( Date.now() - data.url_updated < getConfig().cache_refresh_file)

    ){
      console.log('get gd file from cache')
      return data
    }


    let reallink = ''
    let { body , headers }  = await request.get(host + '/uc?id='+id+'&export=download',{followRedirect : false})
    if(headers && headers.location){
      reallink = headers.location
    }else{
      let url = (body.match(/\/uc\?export=download[^"']+/i) || [''])[0]
      url = url.replace(/&amp;/g,'&')
      let cookie = headers['set-cookie'].join('; ')
      let resp = await request.get(host + url , {headers:{'Cookie':cookie} , followRedirect : false})
      if(resp.headers && resp.headers.location){
        reallink = resp.headers.location
      }
    }

    data.url = reallink
    data.url_updated = Date.now()

    //强制保存 ， data 是指向 父级 的引用
    cache.save()
    return data
  }

  return { name , version, drive:{ protocols, folder , file } }
}