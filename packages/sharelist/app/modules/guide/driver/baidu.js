const { PROXY_URL, render, btoa, atob } = require('./shared')
const querystring = require('querystring')

const getOAuthAccessToken = async (app, url, { client_id, client_secret, redirect_uri, code }, options = {}) => {
  let data = {
    client_id,
    client_secret,
    redirect_uri,
    code,
    grant_type: 'authorization_code'
  }

  let resp

  try {
    resp = await app.request(url, {
      method: 'get',
      data,
      ...options,
    })
  } catch (e) {
    resp = { error: e?.message || e.toString() }
  }
  if (resp.data.error) {
    return { error: resp.data.error_description || resp.data.error }
  }

  return resp.data
}

module.exports = async function (ctx, next, app) {
  if (ctx.request.body && ctx.request.body.act && ctx.request.body.act == 'install') {
    let { client_id, client_secret } = ctx.request.body
    if (client_id && client_secret) {
      let baseUrl = ctx.origin + '/@guide/baidu/' + btoa([client_id, client_secret].join('::')) + '/callback'

      const opts = {
        client_id: client_id,
        scope: 'basic,netdisk',
        response_type: 'code',
        redirect_uri: PROXY_URL,
        state: baseUrl
      };

      ctx.redirect(`https://openapi.baidu.com/oauth/2.0/authorize?${querystring.stringify(opts)}`)
    }

  } else if (ctx.params.pairs) {
    let [client_id, client_secret] = atob(ctx.params.pairs).split('::')
    if (ctx.query.code) {
      let credentials = await getOAuthAccessToken(app, 'https://openapi.baidu.com/oauth/2.0/token', { client_id, client_secret, code: ctx.query.code, redirect_uri: PROXY_URL })
      console.log(credentials)
      if (credentials.error) {
        ctx.body = credentials.error
      } else {
        let ret = { AppKey: client_id, SecretKey: client_secret, redirect_uri: PROXY_URL, access_token: credentials.access_token, refresh_token: credentials.refresh_token }

        const cnt = Object.keys(ret).map(i => `<div><div class="label">${i}:</div>${ret[i]}</div>`).join('<br />')
        render(ctx, `
        <div class="guide">
          ${cnt}
        </div >
      `)
      }
    }
    else if (ctx.query.error) {
      ctx.body = req.query.error
    }
  } else {
    render(ctx, `
      <div class="guide">
        <h3>挂载Baidu Netdisk</h3>
        <p>1. 前往 <a target="_blank" style="margin-right:5px;cursor:pointer;" href="https://pan.baidu.com/union/console/createapp">Baidu网盘开发平台</a> 注册应用获取 API KEY" 和 SECRET KEY，注册类别 请选择为【软件】。<br />2. 前往 <a target="_blank" style="margin-right:5px;cursor:pointer;" href="https://pan.baidu.com/union/console/applist">应用详情->安全设置</a> 将【OAuth授权回调页】设置为: </p>
        <p><a target="_blank" href="https://github.com/reruin/reruin.github.io/blob/master/sharelist/redirect.html" style="font-size:12px;margin-right:5px;color:#337ab7;">https://reruin.github.io/sharelist/redirect.html</a></p>
  
        <form class="form-horizontal" method="post">
          <input type="hidden" name="act" value="install" />
          <div class="form-item" style="font-size:12px;"><label class="flex"><input disabled checked="true" name="custom" id="j_custom" type="checkbox"> 使用自己的应用ID 和 应用机密</label>，请遵循 <a href="https://pan.baidu.com/union/document/protocol" target="_blank">使用协议</a>。</div>
          <div class="form-item"><input id="j_client_id" class="sl-input" type="text" name="client_id" placeholder="应用ID / AppKey" /></div>
          <div class="form-item"><input id="j_client_secret" class="sl-input" type="text" name="client_secret" placeholder="应用机密 / SecretKey" /></div>
          <button class="sl-button btn-primary" id="signin" type="submit">验证 / Verify</button>
        </form>
        <script>
        function toggleCustom(){
          var checked = $('#j_custom').prop("checked")
          if( checked ){
            $('.custom').show()
          }else{
            $('.custom').hide()
          }
        }
        $(function(){
          $('#j_custom').on('change' , function(){
            toggleCustom()
          })
        })
        </script>
      </div>
    `)
  }
}