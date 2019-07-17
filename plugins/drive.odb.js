/*
 * One Drive For Business
 * 此插件限制展示30项
 * id: full path
 */

const name = '(Deprecated)OneDriveForBusiness'

const version = '1.0'

const protocols = ['odb']

const defaultProtocol = 'odb'


module.exports = ({ request, cache, getConfig }) => {

  var cookies = {}

  const parse = (id) => {
    let tmp = id.split('@')
    return [tmp[0], tmp.slice(1).join('@')]
  }

  const getCookie = async (rootId) => {
    if (cookies[rootId]) {
      return [cookies[rootId]]
    } else {
      let res = await request.get(rootId, { followRedirect: false })
      // let cookie = resp.headers['set-cookie'].join('; ')
      let accessUrl = res.headers.location

      res = await request.get(accessUrl, { followRedirect: false })

      let cookie = res.headers['set-cookie'].join('; ')

      cookies[rootId] = cookie

      return [cookie, res.headers.location]
    }
  }

  // folder => files
  const folder = async (id) => {
    const resid = `${defaultProtocol}:${id}`

    let resp = { id, type: 'folder', protocol: defaultProtocol }

    if (cache.get(resid)) {
      resp = cache.get(resid)
      if (
        resp.$cached_at &&
        resp.children &&
        (Date.now() - resp.$cached_at < getConfig('max_age_dir'))

      ) {
        console.log('get folder from cache')
        return resp
      }
    }


    const [rootId, path] = parse(id)

    const baseUrl = id.split('/').slice(0, 3).join('/')

    const [cookie, directUrl] = await getCookie(rootId)

    //字符转义
    let url = baseUrl + encodeURI(path)

    if (directUrl) {
      url = baseUrl + directUrl
    }

    let res = await request.get(url, { headers: { 'Cookie': cookie } })
    let code = (res.body.match(/g_listData\s*=\s*([\w\W]+)(?=;if)/) || ['', ''])[1]
    let data = code.toString(16)
    if (data) {
      try {
        data = JSON.parse(data)
        if (data) {
          data = data.ListData.Row
        }
      } catch (e) {
        data = []
      }
    }

    let children = data ? data.map((i) => {
      return {
        id: rootId + '@' + i.FileRef,
        name: i.FileLeafRef,
        ext: i['.fileType'],
        protocol: defaultProtocol,
        created_at: '-',
        updated_at: i.Modified,
        size: i.FileSizeDisplay,
        type: i.FSObjType == '1' ? 'folder' : undefined,
      }
    }) : []


    //folder 额外保存 
    resp.children = children
    resp.$cached_at = Date.now()

    cache.set(resid, resp)
    return resp
  }

  /**
   * 必须使用cookie才能下载，故此只能使用中转模式
   */
  const file = async (id, data) => {

    const [rootId, path] = parse(id)
    const [cookie, _] = await getCookie(rootId)

    const baseUrl = id.split('/').slice(0, 3).join('/')

    let url = baseUrl + encodeURI(path)
    return {
      url: url,
      name: data.name,
      ext: data.ext,
      protocol: defaultProtocol,
      proxy: true,
      headers: { 'Cookie': cookie }
    }
  }

  return { name, version, drive: { protocols, folder, file } }
}
