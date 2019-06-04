/*
 * www.lanzous.com
 * lanzou:password@foldId / foldId
 */

const name = 'Lanzous'

const version = '1.0'

const protocols = ['lanzou']

const defaultProtocol = 'lanzou'

const host = 'https://www.lanzous.com'

module.exports = ({ request , getConfig , datetime , cache , retrieveSize }) => {

  const allowExt = 'd,apk,zip,rar,txt,7z,z,e,ct,doc,docx,exe,ke,db,tar,pdf,epub,mobi,azw,azw3,w3x,osk,osz,jar,xpk,cpk,lua,dmg,ppt,pptx,xls,xlsx,mp3,gz,psd,ipa,iso,ttf,txf,ttc,img,bin,gho,patch'.split(',')

  const parse = (id) => {
    let tmp = id.split('@')
    let passwd , fid
    if( tmp.length == 2 ){
      passwd = tmp[0]
      fid = tmp[1]
    }else if( tmp.length == 1){
      fid = id
    }
    return { passwd , fid }
  }

  const allowExtReg = new RegExp('('+allowExt.join('|')+').txt$')
  const filterExt = (name) => {
    if(!allowExtReg.test(name)){
      return name.replace(/\.txt$/,'')
    }else{
      return name
    }
  }

  const getFormDataForFolder = (body) => {
    let data = (body.match(/(?<=data\s*:\s*)\{[\w\W]*?\}/) || [''])[0]
    if( data ){
      data = data.replace(/\s/g,'').replace(/\'/g,'"').replace(',}','}')
      let formdata = {}

      try{
        let field_k = data.match(/(?<=\"k\":)[^\s,\}]+/)[0]
        let field_t = data.match(/(?<=\"t\":)[^\s,\}]+/)[0]
        let value_k = body.match(new RegExp('(?<='+field_k+"\\s*=\\s*')[^']+"))[0]
        let value_t = body.match(new RegExp('(?<='+field_t+"\\s*=\\s*')[^']+"))[0] // timestamp
        data = data.replace(new RegExp('(pgs|'+field_k+'|'+field_t+')','g'),'""').replace(/\'/g,'"').replace(/(?<=:)pwd/,'""')
        formdata = JSON.parse( data )
        formdata.k = value_k
        formdata.t = value_t
        delete formdata.pwd
        return formdata
      }catch(e){
        return false
      }

    }else{
      return false
    }
  }

  const updateFile = (f) => {
    
    if(f.name.endsWith('.d.txt')){
      f.id = f.name.split('.').slice(-3,-2)[0]
      f.name = f.name.split('.').slice(0,-3).join('.')
      f.type = 'folder'
      f.size = null
      f.ext = null
    }
    return f
  }

  // gd folder => files
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
    if(params.fid){
      let { body , headers } = await request.get(host+'/'+params.fid)
      let cookie = headers['set-cookie'].join('; ')
      let formdata = getFormDataForFolder(body)
      if( formdata ){
        formdata.pg = 1
        if(params.passwd) {
          formdata.pwd = params.passwd
        }

        let res = await request.post(`${host}/filemoreajax.php` , formdata ,{headers:{'Cookie':cookie} , json:true})
        if(res.body.zt != 1){
          res.body.text = []
        }
        if( res.body && res.body.text){
          resp = {id , type:'folder' , protocol:defaultProtocol}
          let children = []
          res.body.text.forEach( i => {
            let name = filterExt(i.name_all)//.replace(/\.ct$/,'')
            console.log(i)

            children.push(updateFile({
              id:i.id,
              name:name,
              ext:name.split('.').pop(),
              protocol:defaultProtocol,
              // updated_at:datetime(i.upload_at*1000),
              size:retrieveSize(i.size),
              displaySize:i.size,
              type : undefined,
            }))
          })

          //folder 额外保存 
          resp.children = children
          resp.$cached_at = Date.now()

          cache.set(resid,resp)
        }
      }

    }

    return resp
  }

  /**
   * 获取文件实际路径
   */
  const file = async(id , data = {}) =>{
    
    let { body }  = await request.get(`${host}/tp/${id}` , {headers:{'User-Agent':'Mozilla/5.0 (Linux; Android 6.0; 1503-M02 Build/MRA58K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Mobile MQQBrowser/6.2 TBS/036558 Safari/537.36 MicroMessenger/6.3.25.861 NetType/WIFI Language/zh_CN'}})
    let url , base

    url = (body.match(/(?<=link[^\=]*=\s*')[^']+/) || [false])[0]
    base = (body.match(/(?<=urlp[^\=]*=\s*')[^']+/)|| [false])[0]
    if(url == false){
      url = (body.match(/(?<=urlp[^\"\']*[\"\']\s*)\?[^'"]+/)|| [false])[0]
      if( url == false){
        return false
      }
    }
    url = base + url
    data.url = url
    data.$cached_at = Date.now()
    cache.save()
    return data
  }

  return { name , version, drive:{ protocols, folder , file } }
}