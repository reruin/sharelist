
const { getOAuthAccessToken, PROXY_URL, render } = require('./shared')
const querystring = require('querystring')

const support_zone = {
  'GLOBAL': [
    'https://login.microsoftonline.com',
    'https://graph.microsoft.com',
    'https://portal.azure.com',
    '全球',
    'https://www.office.com/',
    ['00cdbfd5-15a5-422f-a7d7-75e8eddd8fa8', 'pTvE-.ooe8ou5p1552O8s.3WK996UZ.Z8M'],
  ],
  'CN': [
    'https://login.chinacloudapi.cn',
    'https://microsoftgraph.chinacloudapi.cn',
    'https://portal.azure.cn',
    '世纪互联',
    'https://portal.partner.microsoftonline.cn/Home',
    ['9430c343-440f-44f3-ba1d-18b77c0072af', '8f3.2dD-_.6mLv-VmMo6vCxuYcm5~Liqn4'],
  ],
  'DE': [
    'https://login.microsoftonline.de',
    'https://graph.microsoft.de',
    'https://portal.microsoftazure.de',
    'Azure Germany'
  ],
  'US': [
    'https://login.microsoftonline.us',
    'https://graph.microsoft.us',
    'https://portal.azure.us',
    'Azure US GOV',
  ]
}

const getAuthority = (zone, tenant_id) => {
  return support_zone[zone || 'COMMON'][0] + '/' + (tenant_id || 'common')
}
const getGraphEndpointSite = (zone, site_name) => {
  return support_zone[zone || 'COMMON'][1] + '/v1.0/sites/root:/' + site_name
}

const getDefaultConfig = (zone) => {
  return support_zone[zone || 'COMMON'][5] || []
}

const getAccessToken = async (app, data) => {
  let { zone, site_name, ...formdata } = data
  let metadata = getAuthority(zone)

  formdata.redirect_uri = PROXY_URL
  formdata.grant_type = 'authorization_code'

  let resp
  try {
    resp = await app.curl.post(`${metadata}/oauth2/v2.0/token`, {
      data: formdata
    })
  } catch (e) {
    resp = { error: e.toString() }
  }
  if (resp.error) return resp

  if (resp.body.error) {
    return { error: resp.body.error_description || resp.body.error }
  }

  let ret = { ...resp.data }
  // get sharepoint site id
  if (site_name) {
    let api = getGraphEndpointSite(zone, site_name)
    try {
      let resp = await app.curl(api, {
        headers: {
          'Authorization': 'Bearer ' + ret.access_token
        }
      })
      ret.site_id = resp.body.id
    } catch (e) {
      return { error: 'parse site id error' }
    }
  }
  return ret
}

module.exports = async function (ctx, next) {
  if (ctx.request.body && ctx.request.body.act && ctx.request.body.act == 'install') {
    let { client_id, client_secret, zone, tenant_id = 'common', custom, sharepoint_site, type } = ctx.request.body
    let site_name, err
    if (custom) {
      if (!client_id || !client_secret) {
        err = 'require client_id and client_secret'
      }
    } else {
      [client_id, client_secret] = getDefaultConfig(zone)
      if (!client_id) {
        err = '暂不支持当前地域'
      }
    }

    if (type == 'sharepoint') {
      if (sharepoint_site) {
        let obj = new URL(sharepoint_site)
        site_name = obj.pathname
      } else {
        err = '请填写sharepoint站点URL<br/>require sharepoint site'
      }
    }

    if (err) {
      render(ctx, `
        <div class="auth">
          '<h3>挂载向导</h3>'
          <p style="font-size:12px;">${err}<br /></p>
          <p><a style="font-size:12px;cursor:pointer;" onclick="location.href=location.pathname">点击重新开始</a></p>
        </div >
      `)
    }
    else if (client_id && client_secret && zone) {
      let site_name = ''
      if (sharepoint_site) {
        let obj = new URL(sharepoint_site)
        site_name = obj.pathname
      }

      let baseUrl = ctx.origin + '/@guide/onedrive/' + this.app.utils.btoa([client_id, client_secret, zone, site_name].join('::')) + '/callback'

      const opts = {
        client_id: client_id,
        scope: [
          'offline_access',
          'files.readwrite.all'
        ].join(' '),
        response_type: 'code',
        redirect_uri: PROXY_URL,
        state: baseUrl
      };
      ctx.redirect(`${support_zone[zone][0] + '/' + (tenant_id || 'common')}/oauth2/v2.0/authorize?${querystring.stringify(opts)}`)
    }
  }
  // 挂载验证回调
  else if (ctx.params.pairs) {
    let [client_id, client_secret, zone, site_name] = this.app.utils.atob(ctx.params.pairs).split('::')
    if (ctx.query.code) {
      let credentials = await getAccessToken(this.app, { client_id, client_secret, code: ctx.query.code, zone, site_name })
      if (credentials.error) {
        ctx.body = credentials.error
      } else {

        let ret = { client_id, client_secret, redirect_uri: PROXY_URL, refresh_token: credentials.refresh_token }

        if (site_name) {
          let api = getGraphEndpointSite(zone, site_name)
          try {
            let resp = await this.app.curl(api, {
              headers: {
                'Authorization': 'Bearer ' + credentials.access_token
              }
            })
            ret.site_id = resp.data.id
          } catch (e) {
            ctx.body = 'parse site id error'
            return
          }
        }

        ctx.body = Object.keys(ret).map(i => `<div>${i}:${ret[i]}</div>`).join('<br />')
      }
    }
    else if (ctx.query.error) {
      ctx.body = req.query.error
    }
  }

  else {
    let zone = [], types = ['onedrive', 'sharepoint']

    for (let [key, value] of Object.entries(support_zone)) {
      zone.push(`<option value="${key}" data-sharepoint="${value[4] || ''}" data-portal="${value[2] || ''}" ${key == 'COM' ? 'selected' : ''}>${value[3]}</option>`)
    }

    render(ctx, `<div class="auth">
      <h3>OneDrive 挂载向导</h3>
      
      <form class="form-horizontal" method="post">
        <div class="l-center" style="font-size:13px;margin-bottom:24px;">
          <label><input type="radio" name="type" value="onedrive" checked /> OneDrive 挂载</label>
          <label><input type="radio" name="type" value="sharepoint" /> SharePoint 挂载</label>
          <label><input type="radio" name="type" value="sharelink" /> SharePoint 分享链接挂载</label>
        </div>
        <input type="hidden" name="act" value="install" />

        <div class="form-body">
          <div class="form-item tab tab-onedrive tab-auto tab-sharepoint">
            <select id="j_zone" name="zone">
              ${zone.join('')}
            </select>
          </div>
          <div class="tab tab-sharepoint">
            <p>前往 <a style="margin-right:5px;cursor:pointer;" id="j_portal_office">office365</a>，点击应用 sharepoint，创建一个网站，将URL地址填入下方输入框中。</p>
            <input class="sl-input zone_change_placeholder" type="text" name="sharepoint_site" value="" placeholder="URL https://xxxxxx.sharepoint.com/sites(teams)/xxxxxx" />
          </div>
          <div class="tab tab-sharepoint tab-onedrive">
            <div class="form-item" style="font-size:12px;"><label><input name="custom" id="j_custom" type="checkbox"> 使用自己的应用ID 和 应用机密</label></div>
            <div class="tab-custom">
              <p>前往 <a style="margin-right:5px;cursor:pointer;" id="j_portal">Azure管理后台</a> 注册应用获取 应用ID 和 应用机密。重定向 URI 请设置为: </p>
              <p><a target="_blank" href="https://github.com/reruin/reruin.github.io/blob/master/sharelist/redirect.html" style="font-size:12px;margin-right:5px;color:#337ab7;">https://reruin.github.io/sharelist/redirect.html</a></p>
              <div class="form-item"><input class="sl-input" type="text" name="client_id" value="" placeholder="应用ID / app_id" /></div>
              <div class="form-item"><input class="sl-input" type="text" name="client_secret" value="" placeholder="应用机密 / app_secret" /></div>
              <div class="form-item"><input class="sl-input" type="text" name="tenant_id" value="" placeholder="租户ID / tenant_id (多租户可选)" /></div>

            </div>
          </div>
          

          <div class="form-item tab tab-sharelink"><input class="sl-input" type="text" name="share_url" value="" placeholder="URL https://xxxx.sharepoint.com/:f:/g/personal/xxxxxxxx/mmmmmmmmm?e=XXXX" /></div>

        </div>
        <button class="sl-button btn-primary" id="signin" type="submit">验证</button>
      </form>
      
    </div>
    <script>
      function toggleType(type){
        // $('.tab.tab-'+type).fadeIn().siblings('.tab').fadeOut() 
        $('.tab').hide()
        $('.tab.tab-'+type).fadeIn(150)
        toggleCustom()

      }

      function toggleCustom(){
        var checked = $('#j_custom').prop("checked")
        if( checked ){
          $('.tab-custom').show()
        }else{
          $('.tab-custom').hide()
        }
      }

      $(function(){
        $('input:radio[name=type]').on('change', function() {
          toggleType(this.value)
        });

        $('#j_portal').on('click' , function(){
          var option = $("#j_zone option:selected")
          var portal = option.attr('data-portal') + '/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade';

          window.open(portal)
        })

        $('#j_portal_office').on('click' , function(){
          var option = $("#j_zone option:selected")
          var portal = option.attr('data-sharepoint');
          if( portal ){
            window.open(portal)
          }else{
            alert('暂不支持当前地域')
          }
        })

        $('#j_type').on('change' , function(){
          $('.form-item').hide()
          $('.form-item.tab-'+type).fadeIn(150)
        })

        $('#j_custom').on('change' , function(){
          toggleCustom()
        })

        $('#j_zone').on('change' , function(){
          let zone = $(this).val().toLowerCase()
          $('input.zone_change_placeholder').each(function(){
            var tip = $(this).attr('placeholder')
            $(this).attr('placeholder' , tip.replace(/sharepoint\.[a-z]+/,'sharepoint.'+zone))
          })
        })
        
        toggleType($('input:radio[name=type]:checked').val())
      })


    </script>
  `)
  }
}