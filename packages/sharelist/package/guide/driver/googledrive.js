const { getOAuthAccessToken, PROXY_URL, render } = require('./shared')
const querystring = require('querystring')

module.exports = async function (ctx, next) {
  if (ctx.request.body && ctx.request.body.act && ctx.request.body.act == 'install') {
    let { client_id, client_secret, redirect_uri, code } = ctx.request.body

    // let baseUrl = ctx.origin + '/@guide/onedrive/' + this.app.utils.btoa([client_id, client_secret].join('::')) + '/callback'

    // const opts = {
    //   client_id: client_id,
    //   scope: ['https://www.googleapis.com/auth/drive'].join(' '),
    //   response_type: 'code',
    //   redirect_uri: PROXY_URL,
    //   state: baseUrl
    // };
    // ctx.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${querystring.stringify(opts)}`)

    let credentials = await getOAuthAccessToken(this.app, 'https://oauth2.googleapis.com/token', { client_id, client_secret, code, redirect_uri })
    if (credentials.error) {
      ctx.body = credentials.error
    } else {
      let ret = { client_id, client_secret, redirect_uri, refresh_token: credentials.refresh_token }
      ctx.body = Object.keys(ret).map(i => `<div>${i}:${ret[i]}</div>`).join('<br />')
    }
  } else if (ctx.params.pairs) {
    let [client_id, client_secret] = this.app.utils.atob(ctx.params.pairs).split('::')
    console.log(client_id, client_secret)
    if (ctx.query.code) {
      let credentials = await getOAuthAccessToken(this.app, 'https://oauth2.googleapis.com/token', { client_id, client_secret, code: ctx.query.code, redirect_uri: PROXY_URL })
      if (credentials.error) {
        ctx.body = credentials.error
      } else {
        ctx.body = Object.keys(credentials).map(i => `<div>${i}:${credentials[i]}</div>`).join('<br />')
      }
    }
    else if (ctx.query.error) {
      ctx.body = req.query.error
    }
  } else {
    render(ctx, `
    <div class="auth">
      <h3>挂载GoogleDrive</h3>
      <p>1. 请参考 <a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" href="https://developers.google.com/workspace/guides/create-project">此链接</a>创建项目，获取 Client ID / Client Secret。</p>
      <p>2. 在下方填写Client ID / Client Secret后，<a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" id="j_code_link"  onclick="directToCodeUrl(this)">点击获取验证code</a>，若出现[Google hasn’t verified this app]，请展开Advanced，点击[Go to Quickstart (unsafe)]。 </p>

      <form class="form-horizontal"  method="post">
        <input type="hidden" name="act" value="install" />
        <input type="hidden" name="redirect_uri" id="j_direct_uri" value="urn:ietf:wg:oauth:2.0:oob" />
        <div class="form-item"><input id="j_client_id" class="sl-input" type="text" name="client_id" placeholder="应用ID / Client ID" /></div>
        <div class="form-item"><input id="j_client_secret" class="sl-input" type="text" name="client_secret" placeholder="应用机密 / Client Secret" /></div>
        <div class="form-item"><input id="j_code" class="sl-input" type="text" name="code" placeholder="code" /></div>
        <button class="sl-button btn-primary" id="signin" type="submit">验证 / Verify</button>
      </form>
      <script>
        var codeUrl;
        function readFile(input){
          if (window.FileReader) {
            var file = input.files[0];
            filename = file.name.split(".")[0];
            var reader = new FileReader();
            reader.onload = function() {
              try{
                var d = JSON.parse( this.result );
                var data = Object.values(d)[0]
                var client_id = data.client_id;
                var client_secret = data.client_secret;
                var redirect_uris = data.redirect_uris;

                var hit = redirect_uris.find(function(i){
                  return  i.indexOf('urn:ietf') == 0
                })

                document.querySelector('#j_client_id').value = client_id;
                document.querySelector('#j_client_secret').value = client_secret;

                if(hit){
                  codeUrl = "https://accounts.google.com/o/oauth2/auth?client_id="+client_id+"&redirect_uri="+hit+"&response_type=code&access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&approval_prompt=auto";

                  document.querySelector('#j_direct_uri').value = hit;
                }
                
              }catch(e){
                console.log(e)
                alert('文件无效')
              }
            }
            reader.readAsText(file,"UTF-8");
          }
        }

        function directToCodeUrl(el){
          var client_id = document.querySelector('#j_client_id').value ;
          var client_secret = document.querySelector('#j_client_secret').value;
          if(client_id && client_secret){
            var codeUrl = "https://accounts.google.com/o/oauth2/auth?client_id="+client_id+"&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&approval_prompt=auto";

            window.open(codeUrl)
          }else{
            alert('请输入Client ID / Client Secret')
          }
        }
      </script>
    </div> `)
  }
}