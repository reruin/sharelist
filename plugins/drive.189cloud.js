const name = '189CloudCookie'

const version = '1.0'

const protocols = ['ctcc']

const defaultProtocol = 'ctcc'

const { URL } = require('url')

const urlFormat = require('url').format

const COOKIE_MAX_AGE = 5 * 24 * 60 * 60 * 1000 // 5 days

const max_age_dir = 10 * 60 * 1000

const install = async (msg) => {
  return `
    <div class="auth">
      <h3>天翼云 挂载向导</h3>
      ${ msg ? '<p style="font-size:12px;">'+msg+'</p>' : '' }
      <div>
        <form class="form-horizontal" method="post">
          <input type="hidden" name="act" value="install" />
          <div class="form-group"><input class="sl-input" type="text" name="username" value="" placeholder="用户名" /></div>
          <div class="form-group"><input class="sl-input" type="password" name="password" value="" placeholder="密码" /></div>
          <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
      </div>
    </div>
  `
}


class Manager {
  constructor(request, recognize, updateHandle) {
    this.clientMap = {}
    this.request = request
    this.recognize = recognize
    this.updateHandle = updateHandle
  }

  async ocr(image){
    let resp = await this.recognize(image,'189cloud')
    let ret = { error:resp.error , msg:resp.msg }
    if(!resp.error){
      let code = resp.result.replace(/[^a-z0-9]/i,'')
      // retry
      if(code.length == 4){
        ret.code = code
      }else{
        ret.code = ''
      }
    }

    return ret
  }

  init(d){
    for(let i of d) {
      let data = this.parse(i.path)
      this.clientMap[data.username] = data
    }
  }

  // 根据id 获取
  async get(id){
    let data = this.parse(id)
    if(data.username){
      let hit = this.clientMap[data.username]
      if(hit){
        if( !hit.cookies || (Date.now() - hit.updated_at) > COOKIE_MAX_AGE ){
          let { result , msg } = await this.create(hit.username , hit.password)
          if( result ){
            hit = this.clientMap[data.username]
          }else{
            return { error : msg }
          }
        }
      }

      if(hit){
        return { ...hit, path:data.path }
      }else{
        return { error:'挂载失败，请确保账号或者密码正确' }
      }
    }

    return { error:'' }
  }

  parse(path , name){
    let data = new URL(path)
    return {
      name,
      username:data.hostname,
      password:data.searchParams.get('password'),
      cookies:data.searchParams.get('cookies'),
      protocol:data.protocol.split(':')[0],
      path: data.pathname.replace(/^\//,''),
    }
  }

  stringify({ path , username , password , cookies }){
    let query = {}
    if(password) query.password = password
    if(cookies) query.cookies = cookies
    return urlFormat({
      protocol: defaultProtocol,
      hostname: username,
      pathname: (path == '' ) ? '/' : path,
      slashes:true,
      query,
    })
  }

  async needcaptcha(formdata,cookies){
    let resp = await this.request.post('https://open.e.189.cn/api/logbox/oauth2/needcaptcha.do',formdata,{
      headers:{
        Cookies:cookies,
        Referer:'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do'
      },
    })
    if(resp.body && resp.body == '1'){
      return true
    }else{
      return false
    }
  }
  //create cookies
  async create(username , password , path = '/'){
    //0 准备工作： 获取必要数据
    let headers = {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'}
    let { body , headers:headers2} = await this.request.get('https://cloud.189.cn/udb/udb_login.jsp?pageId=1&redirectURL=/main.action',{headers})

    let captchaToken = (body.match(/name='captchaToken' value='(.*?)'>/) || ['',''])[1],
    returnUrl = (body.match(/returnUrl = '(.*?)'\,/) || ['',''])[1],
    paramId = (body.match(/var paramId = "(.*?)";/) || ['',''])[1],
    lt = (body.match(/var lt = "(.*?)";/) || ['',''])[1],
    reqId = (body.match(/reqId = "(.*?)";/) || ['',''])[1]
    
    let cookies = headers2['set-cookie'].join('; ')

    let formdata = {
      'appKey': 'cloud',
      'accountType':'01',
      'userName':username,
      'password':password,
      'validateCode':'',
      'captchaToken':captchaToken,
      'returnUrl':returnUrl,
      'mailSuffix': '@189.cn',
      'dynamicCheck': 'FALSE',
      'clientType': '10010',
      'cb_SaveName': '1',
      'isOauth2': 'false',
      'state':'',
      'paramId':paramId 
    }
    // console.log(headers2)

    let result = false
    let msg = ''
    let needcaptcha = await this.needcaptcha({
      accountType: '01',
      userName:username,
      appKey: 'cloud',
    },cookies)
    console.log('needcaptcha:',needcaptcha)

    while(true){
      // 0 验证码
      if(needcaptcha){
        
        let captchaUrl = `https://open.e.189.cn/api/logbox/oauth2/picCaptcha.do?token=${formdata.captchaToken}&REQID=${reqId}&rnd=${Date.now()}`

        let resp = await this.request.get(captchaUrl,{
          headers:{
            Cookie:cookies,
            Referer:'https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do'
          },
          encoding: null
        })

        let imgBase64

        if(resp.body){
          imgBase64 = "data:" + resp.headers["content-type"] + ";base64," + Buffer.from(resp.body).toString('base64');
        }
        let { error , code } = await this.ocr(imgBase64)
        console.log('validateCode:['+code+']')

        //服务不可用
        if(error){
          formdata.validateCode = ''
          msg = '验证码识别接口无法使用'
          break;
        }
        else if(code){
          formdata.validateCode = code
        }
        //无法有效识别
        else{
          continue;
        }
        
      }

      // 1 登陆
      let resp = await this.request.post('https://open.e.189.cn/api/logbox/oauth2/loginSubmit.do',formdata , {
        headers:{
          'Referer':'https://cloud.189.cn/udb/udb_login.jsp?pageId=1&redirectURL=/main.action',
          'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          'REQID':reqId,
          'lt':lt,
        },
        json:true
      })

      //验证码错误
      if(resp.body.result == -2){
        console.log('validateCode:['+formdata.validateCode+'] error')

        continue;
      }

      if( resp.body && resp.body.toUrl ){
        resp = await this.request.get(resp.body.toUrl , { followRedirect:false, headers })
        let cookies = resp.headers['set-cookie'].join('; ')
        let client = { username , password , cookies , updated_at: Date.now() , path }
        if(this.clientMap[username]){
          client.path = this.clientMap[username].path
        }

        this.clientMap[username] = client

        await this.updateHandle(this.stringify({username , password, path:client.path}))

        result = true
        break;
      }else{
        msg = resp.body.msg
        break;
      }

    }

    return { result , msg }
  }

  async update(id){
    let data = this.parse(id)
    if(data.username){
      let hit = this.clientMap[data.username]
      if(hit){
        return await this.create(hit.username , hit.password)
      }
    }
  }
}
// fileid->app_credentials
module.exports = ({ request, cache, getConfig, querystring, base64, saveDrive, getDrive, getDrives , getRuntime , wrapReadableStream, recognize}) => {

  const manager = new Manager(request , recognize, async (client) => {
    let paths = await getDrives()
    let data = paths
      .map(i => manager.parse(i.path , i.name))


    const name = decodeURIComponent(getRuntime('req').path.replace(/^\//g,''))
    let hit = data.filter(i => i.name == name)

    //路径也无法匹配
    if( hit.length == 0 ){
      //仅有一个可用挂载源
      if(data.length == 1 && paths.length == 1 && paths[0].root){
        hit = data
      }
    }

    hit.forEach(i => {
      saveDrive(client , i.name)
    })
  })

  //获取所有相关根目录，并创建凭证
  getDrives().then(resp => {
    manager.init(resp)
  })

  const prepare = async (id) => {
    if(!id.startsWith(defaultProtocol)){
      id = defaultProtocol + ':' + id
    }
    const req = getRuntime('req')

    let baseUrl = req.origin + req.path

    let { path, cookies, username, error } = await manager.get(id)

    if( error ){
      return { id, type: 'folder', protocol: defaultProtocol,body: await install(error) }
    }

    if( cookies ) {

      return { cookies , path , username }

    }else{
      if (req.body && req.body.username && req.body.password && req.body.act == 'install') {
        let { username, password } = req.body
        let { result , msg } = await manager.create(username , password)
        if( result ){
          return { id, type: 'folder', protocol: defaultProtocol,redirect: req.origin + req.path }
        }else{
          return { id, type: 'folder', protocol: defaultProtocol,body: await install(msg || '请确认账号密码正确') }
        }
      }

      return { id, type: 'folder', protocol: defaultProtocol,body: await install(error) }
    }

  }

  const fetchData = async (id,rest) => {
    let resp , retry_times = 5
    while(true && --retry_times){
      resp = await request({async:true,...rest})
      //cookie失效
      if(resp.headers['Content-Type'] && resp.headers['Content-Type'].includes('text/html')){
        let { result , msg } = await manager.update(id)
        if( result ){
          resp = { msg }
          break;
        }else{
          continue
        }
      }else{
        break;
      }
    }
    
    return resp
  }

  const folder = async (id, options) => {

    let predata = await prepare(id)

    if (!predata.cookies) return predata

    let { path, cookies , username } = await prepare(id)

    let r = cache.get(id)
    if (r) {
      if (
        r.$cached_at &&
        r.children &&
        (Date.now() - r.$cached_at < max_age_dir)

      ) {
        console.log(Date.now()+' CACHE 189Cloud '+ id)
        return r
      }
    }
   
    if(!path) path = -11

    let children = [] , pageNum = 1
    while(true){
      let resp = await fetchData(id,{
        url:`https://cloud.189.cn/v2/listFiles.action?fileId=${path}&mediaType=&keyword=&inGroupSpace=false&orderBy=1&order=ASC&pageNum=${pageNum}&pageSize=9999&noCache=${Math.random()}`,
        method:'GET',
        headers:{
          'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
          'Cookie': cookies,
        },
        json:true
      })
    
      if (!resp || !resp.body) {
        return { id, type: 'folder', protocol: defaultProtocol,body:resp.msg || '解析错误' }
      }

      for(let file of resp.body.data){
        let item = {
          id: manager.stringify({username , path:file.fileId}),
          name: file.fileName,
          protocol: defaultProtocol,
          created_at: file.createTime,
          updated_at: file.lastOpTime,
          type: file.isFolder ? 'folder' : 'file',
        }
        if( item.type != 'folder' ){
          item.ext = file.fileType
          item.size = parseInt(file.fileSize)
          item.url = 'https:'+file.downloadUrl

          if(file.icon) item.icon = file.icon.smallUrl
        }
        children.push(item)
      }
      
      let count = resp.body.recordCount
      let currentCount = resp.body.pageNum * resp.body.pageSize

      if( currentCount < count ){
        //翻页
        pageNum++
        continue
      }else{
        break;
      }
    }
    
    let result = { id, type: 'folder', protocol: defaultProtocol }
    result.$cached_at = Date.now()
    result.children = children
    
    cache.set(id, result)

    return result
  }

  // 无临时链接 强制中转
  const file = async (id, options) => {
    let predata = await prepare(id)

    if (!predata.cookies) return predata

    let { path, cookies , username } = await prepare(id)

    let data = options.data || {}
    let resp = await fetchData(id,{
      url:data.url,
      method:'GET',
      followRedirect:false ,
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        'Cookie': cookies,
      }
    })

    if(!resp) return false

    let url = resp.headers.location
    resp = {
      id,
      url,
      name: data.name,
      ext: data.ext,
      protocol: defaultProtocol,
      size:data.size,
    }

    return resp
  }

  const createReadStream = async ({id , size , options = {}} = {}) => {
    let resp = await file(id)
    if(resp.body){
      return resp
    }else{
      let readstream = request({url:resp.url , method:'get'})
      return wrapReadableStream(readstream , { size: size } )
    }
  }

  return { name, label:'天翼云 账号登录版', version, drive: { protocols, folder, file , createReadStream  } }
}