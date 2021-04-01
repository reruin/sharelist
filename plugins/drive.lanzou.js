/*
 * www.lanzous.com
 * lanzou:password@foldId / foldId
 */

const host = 'https://www.lanzous.com'

/**
 * 从页面中获取 请求参数
 * 
 * @param {string} [body] html content
 * @return {obejct | boolean} 
 */
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

/**
 * 从页面中获取 文件夹(会员外链可见)
 * 
 * @param {string} [body] html content
 * @return {obejct[]} 
 */
const getFolderFromPage = (body , protocol) => {
  let ret = []
  body.replace(/mbxfolder"><a href="\/([^"]+).*filename">([\w\W]+?)</g,($0,$1,$2) => {
    ret.push({
      id:$1,
      name:$2,
      protocol,
      type:'folder',
      size:null,
      ext:null
    })
  })
  return ret
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

const accessPage = (name) => {
  return `
    <div class="menu"><div class="auth"><h3>${name}</h3><div><div class="form-group"><input class="sl-input" id="j_passwd" type="password" name="passwd" placeholder="请输入密码"></div><button class="sl-button btn-primary" id="signin" type="submit" onclick="checkAuth()">确定</button></div></div></div>
    <script src="https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js"></script>
    <script>
      function checkAuth(){
        let passwd = $('#j_passwd').val(),path = location.pathname
        $('button').addClass('loading')
        $.ajax({
          url:'', dataType:'json', method:'POST',
          data:{ act:'lanzou_auth' , path : path , passwd : passwd },
          success:function(resp){
            
            if(resp.status == 0){
              if(resp.rurl){
                location.href = resp.rurl
              }else{
                location.reload()
              }
            }else{
              $('button').removeClass('loading')
              alert(resp.message)
            }
          },
          error:function(resp){
            $('button').removeClass('loading')
          }
        })
      }
    </script>
  `
}

class Lanzou {
  constructor() {
    this.name = 'lanzou'
    this.label = '蓝奏云 / Lanzou'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = 'lanzou'

    this.allowExt = 'd,apk,zip,rar,txt,7z,z,e,ct,doc,docx,exe,ke,db,tar,pdf,epub,mobi,azw,azw3,w3x,osk,osz,jar,xpk,cpk,lua,dmg,ppt,pptx,xls,xlsx,mp3,gz,psd,ipa,iso,ttf,txf,ttc,img,bin,gho,patch'.split(',')

    this.convExt = 'txt,ct'

    this.allowExtReg = new RegExp('('+this.allowExt.join('|')+').('+this.convExt.replace(/\,/g,'|')+')$')

    this.downloadCache = {}

    this.accessCache = {}
  }

  /**
   * 转换禁用后缀文件
   * 
   * @param {string} [name]
   * @return {string[]} 
   * @api private
   */
  filterExt(name){
    if(!this.allowExtReg.test(name)){
      return name.replace(new RegExp('.('+this.convExt.replace(/\,/g,'|')+')$'),'')
    }else{
      return name
    }
  }

  parse (id) {
    id = id.replace(this.protocol+'://','')
    let tmp = id.split('@')
    let passwd , fid
    if( tmp.length == 2 ){
      passwd = tmp[0]
      fid = tmp[1]
    }else if( tmp.length == 1){
      fid = id
    }

    let isFolder = fid.startsWith('b') || fid.includes('/')
    return { passwd , fid , isFolder }
  }

  async path(id){

    let { protocol , helper , downloadCache , accessCache } = this

    const ctx = helper.getRuntime()

    if(!id.startsWith(protocol)) id = protocol + '://' + id

    let r = helper.cache.get(id)
    if (r) {
      if (
        r.$cached_at &&
        r.children &&
        (Date.now() - r.$cached_at < helper.getConfig('max_age_dir'))
      ) {
        if(r.$require_auth){
          if( accessCache[id] && ctx.session.access.has(id) ){
            return r
          }
        }else{
          console.log(Date.now() + ' CACHE Lanzou ' + id)
          return r
        }
      }
    }

    let { fid , passwd , isFolder } = this.parse( id )
    
    if (!fid) return false
    if ( isFolder ){
      let { body , headers } = await helper.request.get(host+'/'+fid , { headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36'}})
      let cookie = headers['set-cookie'] ? headers['set-cookie'].join('; ') : ''

      let verifyMode = false

      let require_auth = false

      //需要密码
      if( body && body.includes('id="pwdload') && !passwd ){
        require_auth = true
        //判断当前用户此路径是否已过验证
        if( accessCache[id] && ctx.session.access.has(id) ){
          passwd = accessCache[id]
        }else{
          if( ctx.body.passwd ){
            verifyMode = true
            passwd = ctx.body.passwd
          }else{
            return { id, type: 'folder', protocol: protocol, auth:true , body: accessPage(ctx.paths[ctx.paths.length-1]) }
          }
        }
      }

      let children = getFolderFromPage(body , protocol)
      let formdata = getFormDataForFolder(body)
      if( formdata ){
        if(passwd) {
          formdata.pwd = passwd
        }

        let pg = 1

        while(true){
          let resp = await helper.request.post(`${host}/filemoreajax.php` , { ...formdata , pg} ,{headers:{'Cookie':cookie} , json:true})
          if (!resp || !resp.body) {
            return { id, type: 'folder', protocol: protocol, body: '解析失败' }
          }
          //提示刷新
          if(resp.body.zt == 4) continue

          //密码错误
          if(resp.body.zt == 3) {
            return { id, type: 'folder', protocol: protocol, body: { status:-1 , message:resp.body.info || '密码不正确'} }
          }

          if(resp.body.zt != 1) break;

          if( verifyMode ){
            //缓存密码有备后用
            accessCache[id] = passwd
            ctx.session.access.add(id)
            return { id, type: 'folder', protocol: protocol, body: { status:0, message:'success', rurl: ctx.query.rurl} }
          }

          if(resp.body && resp.body.text){
            resp.body.text.forEach( i => {
              let name = this.filterExt(i.name_all)//.replace(/\.ct$/,'')
              children.push(updateFile({
                id:i.id,
                name:name,
                ext:helper.extname(name),
                protocol,
                // updated_at:datetime(i.upload_at*1000),
                size:helper.retrieveSize(i.size),
                displaySize:i.size,
                type : undefined,
              }))
            })
          }

          pg++
        }
        //folder 额外保存 

        let result = { id, type: 'folder', protocol }
        result.$cached_at = Date.now()
        result.children = children
        result.$require_auth = require_auth
        helper.cache.set(id, result)

        return result
      }else{
        return { id, type: 'folder', protocol: protocol, body: '解析失败' }
      }
    }else{
      let url
      let { body }  = await helper.request.get(`${host}/tp/${fid}` , {headers:{'User-Agent':'Mozilla/5.0 (Linux; Android 6.0; 1503-M02 Build/MRA58K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Mobile MQQBrowser/6.2 TBS/036558 Safari/537.36 MicroMessenger/6.3.25.861 NetType/WIFI Language/zh_CN'}})
      if(downloadCache[fid] && downloadCache[fid].expired_at > Date.now() ){
        url = downloadCache[fid].url
      }else{
        try{
          let code = body.split('<script type="text/javascript">')[1].split('</script>')[0]

          code = 'var data = {}; function $c(){ return data };' + code.replace('document.getElementById','$c').replace(/document/g,'') + ';data.onfocus();return data.href;'
          url = (new Function(code))()
          if( url ){
            let { headers } = await helper.request.get(url,{followRedirect:false})
            if(headers && headers.location){
              url = headers.location

              let expired_at = parseInt((url.match(/(?<=e=)(\d+)/g) || [0])[0]) * 1000
              if(expired_at){
                downloadCache[fid] = { expired_at , url }
              }
            }
          }
         
        }catch(e){
          console.log(e)
        }
      }

      if(!url) return false

      let name = this.filterExt((body.match(/(?<="md">)[^<]+/) || [''])[0].replace(/\s*$/,''))
      return { id , protocol, name , url , ext:helper.extname(name) }

    }
  }

  async folder(id){
    return await this.path(id)
  }

  async file(id){
    return await this.path(id)
  }

  async auth(id , data){
    let { protocol , helper , downloadCache , accessCache } = this

    if(!id.startsWith(protocol)) id = protocol + '://' + id

    let { fid , passwd , isFolder } = this.parse( id )

    let { body , headers } = await helper.request.get(host+'/'+fid , { headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36'}})
    let cookie = headers['set-cookie'] ? headers['set-cookie'].join('; ') : ''

    let formdata = getFormDataForFolder(body)

    let resp = await helper.request.post(`${host}/filemoreajax.php` , { ...formdata , pg:1} ,{headers:{'Cookie':cookie} , json:true})

    if(rsp.body && resp.body.zt != 3) {
      return true
    }else{
      return false
    }
  }
} 

module.exports = Lanzou