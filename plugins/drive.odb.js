/*
 * One Drive For Business
 * 此插件限制展示30项
 * id: full path
 */

const name = 'OneDriveForBusiness'

const version = '1.0'

const protocols = ['odb']

const defaultProtocol = 'odb'


module.exports = ({ request, cache, getConfig , datetime }) => {

  const clientMap = {}

  const parse = (id) => {
    let tmp = id.split('@')
    return [tmp[0], tmp.slice(1).join('@')]
  }

  const getClient = async (rootId) => {
    if (
      clientMap[rootId]  && 
      ( Date.now() - clientMap[rootId][2] < 30 * 60 * 1000 )
    ){
      return clientMap[rootId]
    }
   
    let res = await request.get(rootId, { followRedirect: false })
    let cookie = ''
    if(res.headers && res.headers['set-cookie']){
      cookie = res.headers['set-cookie'].join('; ')

      clientMap[rootId] = [cookie, res.headers.location , Date.now()]

      return clientMap[rootId]
    }

    let accessUrl = res.headers.location

    res = await request.get(accessUrl, { headers:{cookie}, followRedirect: false })

    cookie = res.headers['set-cookie'].join('; ')

    clientMap[rootId] = [cookie, res.headers.location, Date.now()]

    return clientMap[rootId]
    
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

    const [cookie, directUrl] = await getClient(rootId)


    let url
    if( path ){
      url = baseUrl + encodeURI(path)
    }else{
      if (directUrl) {
        url = baseUrl + directUrl.replace(baseUrl,'')
      }
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
    console.log('result',data )

    let children = data ? data.map((i) => {
      return {
        id: rootId + '@' + i.FileRef,
        name: i.FileLeafRef,
        ext: i['.fileType'],
        protocol: defaultProtocol,
        created_at: '-',
        // ref. https://www.liuquanhao.com/memory/2020/01/19/ShareList-OneDrive%E6%8F%92%E4%BB%B6bug%E4%BF%AE%E5%A4%8D.html
        updated_at: datetime(i['Modified.'].replace(/\//g,'-')),
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
  const file = async (id, { data = {} } = {}) => {
    const [rootId, path] = parse(id)
    const [cookie, _] = await getClient(rootId)

    const baseUrl = id.split('/').slice(0, 3).join('/')

    let url = baseUrl + encodeURI(path)
    return {
      id,
      url: url,
      name: data.name,
      ext: data.ext,
      protocol: defaultProtocol,
      proxy: true,
      headers: { 'Cookie': cookie }
    }
  }

  return { name, label:'* OD Business 非API', version, drive: { protocols, folder, file } }
}
