/**
 * OneDrive
 */

const { URL } = require('url')

const protocol = 'onedrive'

const querystring = require('querystring')

const support_zone = {
  GLOBAL: ['https://login.microsoftonline.com', 'https://graph.microsoft.com', '国际版'],
  CN: ['https://login.chinacloudapi.cn', 'https://microsoftgraph.chinacloudapi.cn', '世纪互联'],
  DE: ['https://login.microsoftonline.de', 'https://graph.microsoft.de', 'Azure Germany'],
  US: ['https://login.microsoftonline.us', 'https://graph.microsoft.us', 'Azure US GOV'],
}

class Manager {
  static getInstance(app) {
    if (!this.instance) {
      this.instance = new Manager(app)
    }
    this.instance.init()
    return this.instance
  }

  constructor(app) {
    this.app = app
  }

  async init() {
    this.clientMap = {}
    let d = await this.app.getDrives()
    for (let i of d) {
      let data = this.app.decode(i.path)
      let { key, refresh_token } = data
      let needUpdate = false
      if (!key) {
        if (data.type == 'sharelink' && data.share_url) {
          data.key = key = this.app.utils.btoa(encodeURIComponent(data.share_url))
          needUpdate = true
        } else if ((data.type == 'onedrive' || data.type == 'sharepoint') && data.client_id) {
          data.key = key = data.client_id
          needUpdate = true
        }
      }

      //由于使用key作为 处理相同的 client_id，大部分情况
      if (key) {
        let isUsedKey = this.clientMap[key]
        if (isUsedKey) {
          data.key = key = `${key}.${Date.now()}`
          needUpdate = true
        }
      }

      if (!data.path && data.root_id) {
        data.path = data.root_id
        needUpdate = true
      }

      if (needUpdate) {
        await this.app.saveDrive(data, { refresh_token })
      }

      if (data.type == 'onedrive' || data.type == 'sharepoint') {
        data.graph = this.getGraphEndpoint(data.zone, data.site_id)
      }

      this.clientMap[key] = { ...data }
    }
  }

  getAuthority(zone = 'GLOBAL', tenant_id) {
    return support_zone[zone][0] + '/' + (tenant_id || 'common')
  }

  getGraphEndpoint(zone = 'GLOBAL', site_id = false) {
    return support_zone[zone][1] + '/v1.0' + (site_id ? `/sites/${site_id}` : '/me') + '/drive'
  }

  getGraphEndpointSite(zone = 'GLOBAL', site_name) {
    //sites/' . getConfig('siteid') . '
    return support_zone[zone][1] + '/v1.0/sites/root:/' + site_name
  }

  /**
   * 从分享链接中解析 credentials
   * access token 有效期 5 * 60 * 60 s
   *
   * @param {string} url
   * @param {object} { credentials }
   * @api private
   */
  async refreshShareAccessToken(client_id) {
    const {
      request,
      utils: { atob },
    } = this.app

    const url = decodeURIComponent(atob(client_id))

    let { data, headers, error } = await request(url, {
      responseType: 'text',
      followRedirect: false,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
      },
    })

    if (error) return { error }

    let cookie = headers['set-cookie']
    let obj = new URL(headers['location'])
    let origin = obj.origin
    let rootFolder = obj.searchParams.get('id')
    let account = rootFolder
      .split(' ')[0]
      .replace('/Shared', '')
      .replace(/Documents.*?$/, '')

    let qs = {
      a1: `'${rootFolder.replace(/(?<=Documents).*$/, '')}'`,
      RootFolder: rootFolder,
      TryNewExperienceSingle: 'TRUE',
    }

    let formdata = {
      parameters: {
        __metadata: { type: 'SP.RenderListDataParameters' },
        RenderOptions: 1216519,
        ViewXml:
          '<View Name="{95F0CAAD-9DE2-4864-AE8D-33094C998625}" DefaultView="TRUE" MobileView="TRUE" MobileDefaultView="TRUE" Type="HTML" ReadOnly="TRUE" DisplayName="全部" Url="/personal/mengskysama_makedie_onmicrosoft_com/Documents/Forms/All.aspx" Level="1" BaseViewID="51" ContentTypeID="0x" ImageUrl="/_layouts/15/images/dlicon.png?rev=47"><Query><OrderBy><FieldRef Name="FileLeafRef"/></OrderBy></Query><ViewFields><FieldRef Name="DocIcon"/><FieldRef Name="LinkFilename"/><FieldRef Name="Modified"/><FieldRef Name="SharedWith"/><FieldRef Name="Editor"/></ViewFields><RowLimit Paged="TRUE">70</RowLimit><JSLink>clienttemplates.js</JSLink><XslLink Default="TRUE">main.xsl</XslLink><Toolbar Type="Standard"/></View>',
        AllowMultipleValueFilterForTaxonomyFields: true,
        AddRequiredFields: true,
      },
    }

    let newurl = `${origin}${account}/_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream?@${querystring.stringify(
      qs,
    )}`
    try {
      ;({
        data,
        headers,
        error: error,
      } = await request.post(newurl, {
        data: formdata,
        headers: {
          origin,
          cookie,
          accept: 'application/json;odata=verbose',
          'content-type': 'application/json;odata=verbose',
        },
      }))
    } catch (e) {
      console.log(e)
    }

    if (error) return { error }

    if (data && data.error) {
      return { error: { message: data.error.message.value } }
    }

    if (!data.ListSchema['.driveAccessToken']) {
      return {
        error: {
          message: '请将分享文件夹设置[拥有链接的任何人都可编辑] / The shared folder must be given editing permissions',
        },
      }
    }

    let access_token = data['ListSchema']['.driveAccessToken'].replace('access_token=', '')
    let graph = data['ListSchema']['.driveUrl']
    let expires_at = parseInt(JSON.parse(atob(access_token.split('.')[1]))['exp']) * 1000

    return {
      credentials: {
        access_token,
        expires_at,
        graph,
      },
    }
  }

  /**
   * 刷新令牌 / refresh token
   *
   * @param {object} credentials
   * @param {object} { credentials: object } | { error:true, message:string }
   * @api private
   */
  async refreshAccessToken(credentials) {
    let { client_id, client_secret, redirect_uri, refresh_token, zone, tenant_id, site_id, type, key, root_id } =
      credentials
    if (type == 'sharelink') {
      return this.refreshShareAccessToken(key)
    }

    if (!(client_id && client_secret && refresh_token)) {
      return { error: { message: 'Invalid parameters: An error occurred during refresh access token' } }
    }

    let formdata = {
      client_id: client_id.split('.')[0],
      client_secret,
      redirect_uri,
      refresh_token,
      grant_type: 'refresh_token',
    }

    let metadata = this.getAuthority(zone, tenant_id)

    let { data, error } = await this.app.request.post(`${metadata}/oauth2/v2.0/token`, { data: formdata })

    if (error) return { error }

    if (data.error) {
      return { error: { message: data.error_description || data.error } }
    }

    let expires_at = data.expires_in * 1000 + Date.now()

    return {
      credentials: {
        client_id,
        client_secret,
        zone,
        tenant_id,
        site_id,
        root_id,
        redirect_uri,
        refresh_token: data.refresh_token,
        access_token: data.access_token,
        expires_at,
      },
    }
  }

  /**
   * get credentials by client_id
   *
   * @param {string} [id]
   * @return {object}
   * @api public
   */
  async getCredentials(key) {
    let credentials = this.clientMap[key]
    if (!credentials) {
      return { error: { message: 'unmounted' } }
    }

    // 未初始化(access_token不存在)、即将过期 刷新token
    if (!credentials.access_token || (credentials.expires_at && credentials.expires_at - Date.now() < 5 * 60 * 1000)) {
      let result = await this.refreshAccessToken(credentials)
      if (result.error) {
        return result
      } else {
        credentials = result.credentials
        if (!credentials.graph) {
          credentials.graph = this.getGraphEndpoint(credentials.zone, credentials.site_id)
        } else {
          await this.app.saveDrive({ key, refresh_token: credentials.refresh_token })
        }

        this.clientMap[key] = {
          ...credentials,
        }
      }
    }

    return { credentials }
  }

  async parse(id) {
    let { key, path } = this.app.decode(id)
    let { error, credentials } = await this.getCredentials(key)

    let ret = { key, path, error }
    if (!error) {
      ret.graph = credentials.graph
      ret.access_token = credentials.access_token
      ret.root_id = credentials.root_id
    }
    return ret
  }
}

const mountData = () => {
  let zone = Object.entries(support_zone).map(([key, value]) => {
    return {
      value: key,
      label: value[2],
    }
  })

  return [
    {
      key: 'type',
      label: 'OneDrive 挂载类型',
      type: 'string',
      options: [
        { value: 'onedrive', label: 'OneDrive' },
        { value: 'sharepoint', label: 'SharePoint' },
        { value: 'sharelink', label: 'Share Link / 分享链接' },
      ],
      fields: [
        [
          { key: 'zone', label: '地域', type: 'string', options: zone, required: true },
          { key: 'client_id', label: '应用ID / Client ID', required: true },
          { key: 'client_secret', label: '应用机密 / App Secret', type: 'string', required: true },
          { key: 'redirect_uri', label: '回调地址 / Redirect URI', required: true },
          { key: 'refresh_token', label: '刷新令牌 / Refresh Token', required: true },
          { key: 'tenant_id', label: '租户ID / Tenant ID' },
          { key: 'root_id', label: '初始目录ID' },
        ],
        [
          { key: 'zone', label: '地域', type: 'string', options: zone, required: true },
          { key: 'client_id', label: '应用ID / Client ID', required: true },
          { key: 'client_secret', label: '应用机密 / App Secret', type: 'string', required: true },
          { key: 'redirect_uri', label: '回调地址 / Redirect URI', required: true },
          { key: 'refresh_token', label: '刷新令牌 / Refresh Token', required: true },
          { key: 'site_id', label: 'SharePoint 站点ID / Site ID', type: 'string' },
          { key: 'tenant_id', label: '租户ID / Tenant ID', type: 'string' },
          { key: 'root_id', label: '初始目录ID', type: 'string' },
        ],
        [
          { key: 'share_url', label: '分享链接URL', type: 'string', required: true },
          { key: 'root_id', label: '初始目录ID', type: 'string' },
        ],
      ],
    },
  ]

  /*[{
    key: 'type',
    label: 'OneDrive 挂载类型',
    type: 'string',
    options: [
      { value: 'onedrive', label: 'OneDrive' },
      { value: 'sharepoint', label: 'SharePoint URL' },
      { value: 'sharelink', label: '分享链接' }
    ],
    fields: [
      [
        { key: 'zone', label: '地域', type: 'string', options: zone, required: true },
        {
          key: 'custom_client', type: 'boolean', label: '使用自己的应用ID 和 应用机密', fields: [
            { key: 'client_id', label: '应用ID / Client ID', required: true },
            { key: 'client_secret', label: '应用机密 / App Secret', type: 'string', required: true },
            { key: 'redirect_uri', label: '回调地址 / Redirect URI', required: true },
          ]
        },
        { key: 'refresh_token', label: '刷新令牌 / Refresh Token', required: true },
        { key: 'tenant_id', label: '租户ID / Tenant ID' },
        { key: 'path', label: '初始目录' },
      ]
      ,
      [
        { key: 'zone', label: '地域', type: 'string', options: zone, required: true },
        {
          key: 'custom_client', type: 'boolean', label: '使用自己的应用ID 和 应用机密', fields: [
            { key: 'client_id', label: '应用ID / Client ID', required: true },
            { key: 'client_secret', label: '应用机密 / App Secret', type: 'string', required: true },
            { key: 'redirect_uri', label: '回调地址 / Redirect URI', required: true },
          ]
        },
        { key: 'refresh_token', label: '刷新令牌 / Refresh Token', required: true },
        { key: 'sharepoint_site', label: 'SharePoint 站点URL', type: 'string' },
        { key: 'tenant_id', label: '租户ID / Tenant ID', type: 'string' },
        { key: 'path', label: '初始目录', type: 'string' },
      ]
      ,
      [
        { key: 'share_url', label: '分享链接URL', type: 'string', required: true },
        { key: 'path', label: '初始目录', type: 'string' },
      ]
    ]
  }]
  */
}

/**
 *
 *
 */
class Driver {
  constructor() {
    this.name = 'OneDrive'
    this.mountable = true
    this.cache = true

    this.version = '1.0'
    this.protocol = protocol

    this.max_age_dir = 7 * 24 * 60 * 60 * 1000 // 7 days

    this.guide = mountData()
  }

  onReady(app) {
    this.app = app
    this.manager = Manager.getInstance(app)
  }

  /**
   * Lists or search files
   *
   * @param {string} [id] folder id
   * @param {object} [options] list options
   * @param {object} [options.sort] sort methods
   * @param {object} [options.search] search key
   * @return {object | error}
   *
   * @api public
   */

  async list(id, { sort, search }) {
    let { manager, app, max_age_dir } = this

    let { error, path, key, graph, access_token, root_id } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#list`

    let r = app.cache.get(cacheId)

    if (r && !search) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let fid = path || root_id || ''

    let data = await this._list(graph, access_token, { id: fid, search })

    if (data.error) return data

    data.forEach((i) => {
      i.id = this.app.encode({ key, path: i.id })
    })

    let result = {
      id,
      files: data,
    }

    if (!search) app.cache.set(cacheId, result, max_age_dir)

    return result
  }

  async get(id) {
    let { manager, app } = this

    let { error, path, graph, access_token } = await manager.parse(id)

    if (error) return { error }

    let cacheId = `${id}#get`

    let r = app.cache.get(cacheId)

    if (r) {
      console.log(`${new Date().toISOString()} CACHE ${this.name} ${id}`)
      return r
    }

    let data = await this._get(graph, access_token, { id: path })

    if (data.error) return data

    data.id = id
    // the download link expires after 3600s
    return app.cache.set(cacheId, data, 3500 * 1000)
  }

  async search() {}

  /**
   * @param {string} [graph] api graph
   * @param {string} [access_token] access token for query
   * @param {object} [options]
   * @param {string} [options.id] the file id
   * @param {string} [options.search] search key
   *
   * @return { array | error}
   *
   * docs: https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/api/driveitem_list_children?view=odsp-graph-online
   * TODO: there are two ways to rquest
   * With a known id:  GET /drives/{drive-id}/items/{item-id}/children
   * With a known path: GET /drives/{drive-id}/root:/{path-relative-to-root}:/children
   */
  async _list(graph, access_token, { id, search }) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    // https://makedie-my.sharepoint.com/_api/v2.0/drives/b!0JNeDoFvlUSa2fAugQnhNBuZYcN0WQJPrYD8Vq2FUAfsmI8YwdGNQ5zG5mhlt3sY

    let url = graph + `${id ? `/items/${id}/` : '/root/'}` + `${search ? `search(q='${search}')` : 'children'}`

    let params = {
      $select:
        'id,name,size,file,folder,parentReference,@microsoft.graph.downloadUrl,thumbnails,createdDateTime,lastModifiedDateTime',
      $top: 999999,
      $expand: 'thumbnails',
      $orderby: 'name asc',
    }

    let { data, error } = await request.get(url, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: params,
    })

    if (error) return { error }

    if (data.error) return { error: data.error.message }

    let children = data.value.map((i) => {
      let item = {
        id: i.id,
        name: i.name,
        type: i.folder ? 'folder' : 'file',
        size: i.size,
        ctime: timestamp(i.createdDateTime),
        mtime: timestamp(i.lastModifiedDateTime),
        thumb: i.thumbnails.length > 0 ? i.thumbnails[0].medium.url : '',
        extra: {
          fid: i.id,
          parent_id: i.parentReference?.id,
        },
      }

      if (i.file) {
        if (i.file.hashes) {
          item.extra.sha1 = i.file.hashes.sha1Hash
        }
        item.extra.mime = i.file.mimeType
        item.download_url = i['@microsoft.graph.downloadUrl'] || i['@content.downloadUrl']
      } else if (i.folder) {
        item.extra.child_count = i.folder.childCount
      }
      return item
    })

    return children
  }

  async _get(graph, access_token, { id }) {
    const {
      request,
      utils: { timestamp },
    } = this.app

    let url = `${graph}/items/${id}`

    let { data, error } = await request(url, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        $expand: 'thumbnails',
      },
    })

    if (error) return { error: error }

    if (data.error) return { error: data.error.message }

    return {
      id: data.id,
      name: data.name,
      type: data.folder ? 'folder' : 'file',
      size: data.size,
      ctime: timestamp(data.createdDateTime),
      mtime: timestamp(data.lastModifiedDateTime),
      download_url: data['@microsoft.graph.downloadUrl'] || data['@content.downloadUrl'],
      thumb: data.thumbnails.length > 0 ? data.thumbnails[0].medium.url : '',
      extra: {
        fid: data.id,
        path: data.parentReference ? data.parentReference.path.split('root:')[1] : '',
      },
    }
  }

  async mkdir() {}

  async rm() {}

  async createReadStream(id, options = {}) {
    let resp = await this.path(id)
    if (resp.body) {
      return resp
    } else {
      let readstream = this.app.request({ url: resp.url, method: 'get' })
      return this.app.wrapReadableStream(readstream, { size: resp.size })
    }
  }

  async createWriteStream() {}
}

module.exports = Driver
