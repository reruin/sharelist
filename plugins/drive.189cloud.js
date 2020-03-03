const name = '189CloudCookie'

const version = '1.0'

const protocols = ['ctcc']

const defaultProtocol = 'ctcc'

const { URL } = require('url')

const urlFormat = require('url').format

const COOKIE_MAX_AGE = 120 * 60 * 1000

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
  constructor(request , updateHandle) {
    this.clientMap = {}
    this.request = request
    this.updateHandle = updateHandle
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
        if( !hit.cookies || (Date.now() - hit.updated_at) < COOKIE_MAX_AGE ){
          let result = await this.create(hit.username , hit.password)
          if( result ){
            hit = this.clientMap[data.username]
          }
        }
      }

      if(hit){
        return { ...hit, path:data.path }
      }else{
        return { error:'挂在失败，请确保账号或者密码正确' }
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
  //create cookies
  async create(username , password){
    //0 准备工作： 获取必要数据
    let headers = {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'}
    let { body , headers:headers2} = await this.request.get('https://cloud.189.cn/udb/udb_login.jsp?pageId=1&redirectURL=/main.action',{headers})

    let captchaToken = (body.match(/name='captchaToken' value='(.*?)'>/) || ['',''])[1],
    returnUrl = (body.match(/returnUrl = '(.*?)'\,/) || ['',''])[1],
    paramId = (body.match(/var paramId = "(.*?)";/) || ['',''])[1],
    lt = (body.match(/var lt = "(.*?)";/) || ['',''])[1],
    reqId = (body.match(/reqId = "(.*?)";/) || ['',''])[1]

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
      'cb_SaveName': '0',
      'isOauth2': 'false',
      'state':'',
      'paramId':paramId 
    }
    console.log(headers2)
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

    if( resp.body.result == -1 ){
      return false
    }
    if( resp.body && resp.body.toUrl ){
      resp = await this.request.get(resp.body.toUrl , { followRedirect:false, headers })
      let cookies = resp.headers['set-cookie'].join('; ')
      let client = { username , password , cookies , updated_at: Date.now() }

      await this.updateHandle(this.stringify({username , password}))

      this.clientMap[username] = client

      return true
    }

  }

}
// fileid->app_credentials
module.exports = ({ request, cache, getConfig, querystring, base64, saveDrive, getDrive, getDrives , getRuntime , wrapReadableStream}) => {

  const manager = new Manager(request , async (client) => {
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

    if( cookies ) {

      return { cookies , path , username }

    }else{
      if (req.body && req.body.username && req.body.password && req.body.act == 'install') {
        let { username, password } = req.body
        let result = await manager.create(username , password)
        if( result ){
          return { id, type: 'folder', protocol: defaultProtocol,redirect: req.origin + req.path }
        }else{
          return { id, type: 'folder', protocol: defaultProtocol,body: await install('请确认账号密码正确') }
        }
      }

      return { id, type: 'folder', protocol: defaultProtocol,body: await install(error) }
    }

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
    let resp = await request.get(`https://cloud.189.cn/v2/listFiles.action?fileId=${path}&mediaType=&keyword=&inGroupSpace=false&orderBy=1&order=ASC&pageNum=1&pageSize=9999&noCache=${Math.random()}`,{
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        'Cookie': cookies,
      },
      json:true
    })

    if (!resp.body) {
      return { id, type: 'folder', protocol: defaultProtocol,body:'解析错误' }

    }
    let children = resp.body.data.map( file => {
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
        item.downloadUrl = 'https:'+file.downloadUrl

        if(file.icon) item.icon = file.icon.smallUrl
      }

      return item
    })
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

    let resp = await request.get(data.downloadUrl,{
      followRedirect:false ,
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
        'Cookie': cookies,
      }
    })

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