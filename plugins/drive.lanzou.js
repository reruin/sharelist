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

  const downloadCache = {}

  const allowExt = 'd,apk,zip,rar,txt,7z,z,e,ct,doc,docx,exe,ke,db,tar,pdf,epub,mobi,azw,azw3,w3x,osk,osz,jar,xpk,cpk,lua,dmg,ppt,pptx,xls,xlsx,mp3,gz,psd,ipa,iso,ttf,txf,ttc,img,bin,gho,patch'.split(',')

  const convExt = 'txt,ct'

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

  const allowExtReg = new RegExp('('+allowExt.join('|')+').('+convExt.replace(/\,/g,'|')+')$')
  const filterExt = (name) => {
    if(!allowExtReg.test(name)){
      return name.replace(new RegExp('.('+convExt.replace(/\,/g,'|')+')$'),'')
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
      let { body , headers } = await request.get(host+'/'+params.fid , { headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36'}})
      let cookie = headers['set-cookie'] ? headers['set-cookie'].join('; ') : ''
      let formdata = getFormDataForFolder(body)
      if( formdata ){
        formdata.pg = 1
        if(params.passwd) {
          formdata.pwd = params.passwd
        }

        let res = await request.post(`${host}/filemoreajax.php` , formdata ,{headers:{'Cookie':cookie} , json:true})

        // let cookie = headers['set-cookie'] ? headers['set-cookie'].join('; ') : ''

        if(res.body.zt != 1){
          res.body.text = []
        }
        if( res.body && res.body.text){
          resp = {id , type:'folder' , protocol:defaultProtocol}
          let children = []
          res.body.text.forEach( i => {
            let name = filterExt(i.name_all)//.replace(/\.ct$/,'')
            console.log(name+'<<<')
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
  const file = async(id , { data = {} } = {}) =>{
    
    let url
    let { body }  = await request.get(`${host}/tp/${id}` , {headers:{'User-Agent':'Mozilla/5.0 (Linux; Android 6.0; 1503-M02 Build/MRA58K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Mobile MQQBrowser/6.2 TBS/036558 Safari/537.36 MicroMessenger/6.3.25.861 NetType/WIFI Language/zh_CN'}})
    if(downloadCache[id] && downloadCache[id].expired_at > Date.now() ){
      url = downloadCache[id].url
    }else{
      try{

        let code = body.split('<script type="text/javascript">')[1].split('</script>')[0]

        code = 'var data = {}; function $c(){ return data };' + code.replace('document.getElementById','$c').replace(/document/g,'') + ';data.onfocus();return data.href;'
        url = (new Function(code))()
        if( url ){
          let { headers } = await request.get(url,{followRedirect:false})
          console.log(headers)
          if(headers && headers.location){
            url = headers.location

            let expired_at = parseInt((url.match(/(?<=e=)(\d+)/g) || [0])[0]) * 1000
            if(expired_at){
              downloadCache[id] = { expired_at , url }
            }
          }
        }
       
      }catch(e){
        console.log(e)
      }
    }
    
    //url = 'https://dev25.baidupan.com/060314bb/2020/06/03/314be4db21834f4ca38975eff8e31764.ct?st=wfpNvMCms57yAOrJwj436w&e=1591169395&b=BSMNaAV2VSQCeVZvCzwGZQV_bCzQMeQ_c_c&fi=24056602&pid=183-159-180-160&up='

    if(!url) return false

    let name = (body.match(/(?<="md">)[^<]+/) || [''])[0].replace(/\s*$/,'')
    data.url = url
    data.name = filterExt(name)
    data.$cached_at = Date.now()

    return data
  }

  return { name , label:'蓝奏云',version, drive:{ protocols, folder , file } }
}