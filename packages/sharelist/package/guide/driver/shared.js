exports.PROXY_URL = 'https://reruin.github.io/sharelist/redirect.html'

exports.getOAuthAccessToken = async (app, url, { client_id, client_secret, redirect_uri, code }) => {
  let data = {
    client_id,
    client_secret,
    redirect_uri,
    code,
    grant_type: 'authorization_code'
  }

  let resp
  try {
    resp = await app.curl.post(url, { data })
  } catch (e) {
    resp = { error: e.toString() }
  }

  if (resp.error) return resp

  if (resp.body.error) {
    return { error: resp.body.error_description || resp.body.error }
  }

  return resp.data
}

exports.render = (ctx, cnt) => {
  return ctx.body = `<!DOCTYPE html><html><head><title>ShareList</title><meta charset="utf8"><meta name="viewport" content="width=device-width, initial-scale=1.0,minimum-scale=1.0, maximum-scale=1.0, user-scalable=no"><meta name="referrer" content="never">
  <script src="https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js"></script>
  </head>
  <style>
    .auth{
      width: 80%;
      margin: 10% auto;
      max-width: 560px;
    }
    .l-center{
      margin:auto;
      text-align:center;
    }
    h3{
      font-size:16px;
      text-align:center;
    }
    .auth p,.auth a{
      font-size:12px;
    }
    .auth a{
      color:#337ab7;
    }
    
    .form-item{
      margin-bottom:8px;
    }
    .form-item.show{
      display:block;
    }
    input[type='text'],select,button{
      width:100%;padding:8px;
      box-sizing:border-box;
    }
    button{
      background-color: #0078e7;
      color: #fff;
      border:none;
      outline:none;
    }
    .tab{
      display:none;
    }
  </style>
  <body>${cnt}</body></html>`
}