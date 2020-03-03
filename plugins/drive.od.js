/*
 * One Drive
 * od:OneDriveID
 */

const name = 'OneDrive'

const version = '1.0'

const protocols = ['od', 'onedrive']

const defaultProtocol = 'od'

module.exports = ({ request , cache , getConfig , querystring , datetime }) => {

  var _authkey, _appid, _rootcid, _cookie , _authid

  // get authkey
  const getAuth = async () => {
    if (!_authkey) {
      await updateAuth()
    }
    return { authkey: _authkey, cookie: _cookie, appid: _appid }
  }

  const checkAuthId = (id) => {
    if(!_authid){
      if(/^s!/.test(id)){
        _authid = id
      }
    }
  }

  const updateAuth = async () => {
    let url = 'https://1drv.ms/f/' + _authid
    let resp = await request.get(url, { followRedirect: false })
    if (resp.headers && resp.headers.location) {
      let params = querystring.parse(resp.headers.location.split('?')[1])
      _authkey = params.authkey

      let cid = params.resid.split('!')[0].toLowerCase()
      resp = await request.get('https://onedrive.live.com/?authkey=' + params.authkey + '&id=' + params.resid + '&cid=' + cid, { followRedirect: false })

      _cookie = resp.headers['set-cookie'].join('; ')
      _appid = (resp.body.match(/"appId":"(\d+)"/) || ['', ''])[1]

      console.log('******* update authkey:', _authkey)
    }
  }


  // shareid => id
  const conv = async (shareid) => {
    
    if (cache.get('od:' + shareid)) {
      return cache.get('od:' + shareid)
    }
    
    let url = 'https://1drv.ms/f/' + shareid.replace('od:', '')
    let r = await request.get(url, { followRedirect: false })
    if (r.headers && r.headers.location) {
      let params = querystring.parse(r.headers.location.split('?')[1])
      cache.set('od:' + shareid, params.resid)
      return params.resid
    } else {
      return ''
    }
  }

  // gd folder => files

  // 非公开接口
  const folder = async (id, _) => {
    checkAuthId(id)

    _ = _ || {}
    let nocache = _.nocache
    // shareid
    if (/^s!/.test(id)) {
      id = await conv(id)
    }

    let resid = 'od:' + id
    let resp = { id, type: 'folder', protocol: defaultProtocol, children: [] }

    if (cache.get(resid) && !nocache) {
      resp = cache.get(resid)

      if (
        resp.$cached_at &&
        resp.children &&
        (Date.now() - resp.$cached_at < getConfig('max_age_dir'))

      ) {
        console.log('get od folder from cache')
        return resp
      }
    }


    let { authkey, cookie, appid } = await getAuth()

    let children = []
    console.log('>>>>',id)
    let cid = id.split('!')[0].toLowerCase()

    let opts = {
      authKey: authkey,
      id: id,
      cid: cid,

      //以上参数必须
      caller: '',
      sb: 0,
      ps: 100,
      sd: 0,
      gb: '0,1,2',
      d: '1',
      m: 'zh-CN',
      iabch: '1',
      pi: '5',
      path: '1',
      lct: '1',
      rset: 'odweb',
      v: Math.random(),
      si: '0',

    }
    let headers = {
      "X-SkyApiOriginId": "" + Math.random(),
      "AppId": appid,
      "Accept": "application/json",
      //以上三项必须
      "Host": "skyapi.onedrive.live.com",
      "Referer": "https://skyapi.onedrive.live.com/xmlproxy.htm?domain=live.com",
      "Cookie": cookie
    }

    r = await request.get('https://skyapi.onedrive.live.com/API/2/GetItems?' + querystring.stringify(opts), { followRedirect: false, headers })

    r = JSON.parse(r.body)
    if (r.error) {
      console.log(r)
    } else {

      r = (r.items || [r.item])[0]
      children = r.folder ? r.folder.children.map((i) => {
        let ext = i.extension ? i.extension.replace(/\./g, '') : ''
        
        return {
          id: i.id,
          name: i.name + (i.folder ? '' : i.extension),
          ext: ext,
          protocol: defaultProtocol,
          parent: i.parentId,
          mime: i.mimeType,
          created_at: datetime(i.displayCreationDate.replace(/\//g, '-')),
          updated_at: datetime(i.displayModifiedDate.replace(/\//g, '-')),
          size: parseInt(i.size),
          type: i.folder ? 'folder' : undefined,

          url: i.folder ? '' : i.urls.download,
          $cached_at: Date.now()
        }
      }) : []

      resp.$cached_at = Date.now()
      resp.children = children
      cache.set(resid, resp)
    }
    return resp
  }

  const file = async (id, { data = {} } = {}) => {
    if (
      data &&
      data.$cached_at &&
      data.url &&
      (Date.now() - data.$cached_at < getConfig('max_age_file'))

    ) {
      console.log('get od file from cache')
      return data
    }

    //刷新父路径
    let parent = await folder(data.parent, { nocache: true })

    let hit = parent.children.find( i => i.id == id )

    return hit || ''
  }

  return { name, label:'OD ID挂载版', version, drive:{protocols, folder, file} }
}