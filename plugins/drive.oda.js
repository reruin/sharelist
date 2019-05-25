/*
 * One Drive API
 * 使用官方API挂载
 * token -x-> generateAuthUrl --code--> getToken 
 */

const name = 'OneDriveAPI'

const version = '1.0'

const protocols = ['oda']

const defaultProtocol = 'oda'

const fs = require('fs')

const clientMap = {}

const oauthUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0';

const oauth21 = {

}

//kvfXIY=|jxghTDHU23564:%
// client Id  --> client_id:client_secret
const getClient = async (clientId) => {
  let [client_id, client_secret , refresh_token] = clientId.split(':');
  let key = client_id+':'+client_secret;
  if(clientMap[key]){
    return { client:false , refresh_token}
  }else{
    return { client:false , refresh_token:null}
  }

  let { protocol , username, password, host, port, pathname , searchParams } = new URL(url);
  let remote_url = protocol + '//' + host + pathname
  let hit = clientMap[remote_url]

  if (!hit) {
    let client = createClient(remote_url,{
      username:decodeURIComponent(username),password:decodeURIComponent(password)
    });
    let options = {}
    searchParams.forEach((value, name) => {
      options[name] = value
    })

    clientMap[remote_url] = hit = { client , options }
  }
  
  return hit;
}

module.exports = ({ request, cache, getConfig, querystring, getLocation , base64 }) => {

  // 获取token
  const getToken = () => {

  }

  //生成认证链接
  const generateAuthUrl = (redirect_uri) => {
    if(redirect_uri.startsWith('https:') == false){
      redirect_uri = 'https://oneindex.github.io/'
    }

    let ru = `https://developer.microsoft.com/en-us/graph/quick-start?appID=_appId_&appName=_appName_&redirectUrl=${redirect_uri}&platform=option-node`;
    let deepLink = `/quickstart/graphIO?publicClientSupport=false&appName=sharelist&redirectUrl=${redirect_uri}&allowImplicitFlow=false&ru=` + encodeURIComponent(ru);
    let app_url = "https://apps.dev.microsoft.com/?deepLink=" + encodeURIComponent(deepLink);

    return app_url
  }

  const install = async (redirect_uri) => {
    let authUrl = await generateAuthUrl(redirect_uri)
    return `
      <div class="auth">
        <h3>挂载 OneDrive</h3>
        <p style="font-size:12px;"><a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" href="${authUrl}">访问此链接</a>获取 应用机密 和 应用ID</p>
        <div>
          <form class="form-horizontal" method="post">
            <input type="hidden" name="act" value="install" />
            <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
            <div class="form-group"><input class="sl-input" type="text" name="client_secret" placeholder="应用机密 / app_secret" /></div>
            <div class="form-group"><input class="sl-input" type="text" name="client_id" placeholder="应用ID / app_id" /></div>
            <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
        </div>
      </div>
    `
  }

  const finsh = async () => {
    return `
      <div class="auth">
        <h3>挂载 OneDrive 成功</h3>
        <p style="font-size:12px;"><a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" href="${authUrl}">访问此链接</a>获取 应用机密 和 应用ID</p>
        <div>
          <form class="form-horizontal" method="post">
            <input type="hidden" name="act" value="install" />
            <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
            <div class="form-group"><input class="sl-input" type="text" name="client_secret" placeholder="应用机密 / app_secret" /></div>
            <div class="form-group"><input class="sl-input" type="text" name="client_id" placeholder="应用ID / app_id" /></div>
            <button class="sl-button btn-primary" id="signin" type="submit">验证</button></form>
        </div>
      </div>
    `
  }

  const authorizeUrl = async (client_id, client_secret, redirect_uri , uri) => {
      let scope = encodeURIComponent("offline_access files.readwrite.all");
      let url = oauthUrl+`/authorize?client_id=${client_id}&scope=${scope}&response_type=code&redirect_uri=${redirect_uri}`;
      
      if(uri.indexOf('://localhost') == -1){
        url += '&state='+encodeURIComponent(uri);
      }
      
      return url;
    return 
  }


  const folder = async (id,{req}) => {
    let resid = `${defaultProtocol}:${id}`

    let [clientKey , fid] = id.split('->')

    let { client } = await getClient(clientKey)


    if(req.body && req.body.act && req.body.act == 'install'){
      // let = redirect_uri = req.href
      let { client_id , client_secret , redirect_uri } = req.body
      if(client_id , client_secret , redirect_uri){
        let authorizationUri = await authorizeUrl(client_id , client_secret , redirect_uri , req.href)
        return {
          id,
          type: 'folder',
          protocol: defaultProtocol,
          redirect: authorizationUri
        }
      }
    }


    //最后一步回调
    if(req.query.code){
      
      // 刷新页面 
      return {
        id,
        type: 'folder',
        protocol: defaultProtocol,
        redirect: req.href
      }
    }

    //不存在
    if(client == false){
      let redirect_uri = req.href
      return {
        id,
        type: 'folder',
        protocol: defaultProtocol,
        body: await install(redirect_uri)
      }
    }



    let params = parse(id)

    let redirect_uri = req.href
    let key = `${params.client_id}:${params.client_secret}`

    //
    let { query } = req
    // 初始化回调
    if (query.code) {
      let res = await checkAuth(params.client_id, params.client_secret, query.code)
      if (res == false) {
        return {
          id,
          type: 'folder',
          protocol: defaultProtocol,
          body: await install(params.client_id, params.client_secret, redirect_uri)
        }
      } else {
        return { id, type: 'folder', protocol: defaultProtocol, redirect: req.origin + req.path }
      }
    }

    //没有token
    if (!params.drive) {
      return {
        id,
        type: 'folder',
        protocol: defaultProtocol,
        body: await install(params.client_id, params.client_secret, redirect_uri)
      }
    } else {
      return await list(params.drive)
    }
  }

  const file = () => {

  }
  
  return { name, version, drive: { protocols, folder, file } }
}