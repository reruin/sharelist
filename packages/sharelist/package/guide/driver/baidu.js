const { getOAuthAccessToken, PROXY_URL, render } = require('./shared')
const querystring = require('querystring')

module.exports = async function (ctx, next) {
  if (ctx.request.body && ctx.request.body.act && ctx.request.body.act == 'install') {
    let { client_id, client_secret } = ctx.request.body

    if (client_id && client_secret) {
      let baseUrl = ctx.origin + '/@guide/baidu/' + this.app.utils.btoa([client_id, client_secret].join('::')) + '/callback'

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
    let [client_id, client_secret] = this.app.utils.atob(ctx.params.pairs).split('::')
    console.log(client_id, client_secret)
    if (ctx.query.code) {
      let credentials = await getOAuthAccessToken(this.app, 'https://openapi.baidu.com/oauth/2.0/token', { client_id, client_secret, code: ctx.query.code, redirect_uri: PROXY_URL })
      if (credentials.error) {
        ctx.body = credentials.error
      } else {
        let ret = { client_id, client_secret, redirect_uri, access_token: credentials.access_token, refresh_token: credentials.refresh_token }

        ctx.body = Object.keys(credentials).map(i => `<div>${i}:${credentials[i]}</div>`).join('<br />')
      }
    }
    else if (ctx.query.error) {
      ctx.body = req.query.error
    }
  } else {
    render(ctx, `
      <div class="auth">
        <h3>挂载Baidu Netdisk</h3>
        <p>1. 前往 <a target="_blank" style="margin-right:5px;cursor:pointer;" href="https://pan.baidu.com/union/console/createapp">Baidu网盘开发平台</a> 注册应用获取 API KEY" 和 SECRET KEY，注册类别 请选择为【软件】。<br />2. 前往 <a target="_blank" style="margin-right:5px;cursor:pointer;" href="http://developer.baidu.com/console#app/project">开发者服务管理</a> 设置网盘应用的授权回调页为: </p>
        <p><a target="_blank" href="https://github.com/reruin/reruin.github.io/blob/master/sharelist/redirect.html" style="font-size:12px;margin-right:5px;color:#337ab7;">https://reruin.github.io/sharelist/redirect.html</a></p>
  
        <form class="form-horizontal" method="post">
          <input type="hidden" name="act" value="install" />
          <div class="form-item" style="font-size:12px;"><label class="flex"><input disabled checked="true" name="custom" id="j_custom" type="checkbox"> 使用自己的应用ID 和 应用机密</label>，请遵循 <a href="https://pan.baidu.com/union/document/protocol" target="_blank">使用协议</a>。</div>
          <div class="form-item"><input id="j_client_id" class="sl-input" type="text" name="client_id" placeholder="应用ID / Client ID" /></div>
          <div class="form-item"><input id="j_client_secret" class="sl-input" type="text" name="client_secret" placeholder="应用机密 / Client Secret" /></div>
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