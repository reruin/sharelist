exports.PROXY_URL = 'https://reruin.github.io/sharelist/redirect.html'

exports.render = (ctx, cnt) => {
  return ctx.body = `<!DOCTYPE html><html><head><title>ShareList</title><meta charset="utf8"><meta name="viewport" content="width=device-width, initial-scale=1.0,minimum-scale=1.0, maximum-scale=1.0, user-scalable=no"><meta name="referrer" content="never">
  <script src="https://cdn.staticfile.org/jquery/3.6.0/jquery.min.js"></script>
  </head>
  <style>
    body{
      font-size:14px;
      line-height:1.7em;
    }
    .guide{
      width: 80%;
      margin: 10% auto;
      max-width: 720px;
      word-wrap:break-word;
      word-break:normal; 
    }
    .l-center{
      margin:auto;
      text-align:center;
    }
    .label{
      font-size:12px;
      color:rgba(0,0,0,.5);
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
      padding:8px;
      border-radius:5px;
    }
    .tab{
      display:none;
    }
  </style>
  <body>${cnt}</body></html>`
}

exports.btoa = v => Buffer.from(v).toString('base64')

exports.atob = v => Buffer.from(v, 'base64').toString()