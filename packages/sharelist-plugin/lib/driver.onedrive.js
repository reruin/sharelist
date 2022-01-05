/**
 * OneDrive
 */

const { URL } = require('url')

const protocol = 'onedrive'

const DEFAULT_ROOT_ID = 'root'

const UPLOAD_PART_SIZE = 4 * 1024 * 1024

const UPLOAD_PART_SIZE_LARGE = 16 * 1024 * 1024

const support_zone = {
  GLOBAL: ['https://login.microsoftonline.com', 'https://graph.microsoft.com', '国际版'],
  CN: ['https://login.chinacloudapi.cn', 'https://microsoftgraph.chinacloudapi.cn', '世纪互联'],
  DE: ['https://login.microsoftonline.de', 'https://graph.microsoft.de', 'Azure Germany'],
  US: ['https://login.microsoftonline.us', 'https://graph.microsoft.us', 'Azure US GOV'],
}

const qs = (d) => new URLSearchParams(d).toString()

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
      if (data.expires_at) data.expires_at = +data.expires_at
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

      if (key) {
        let isUsedKey = this.clientMap[key]
        if (isUsedKey) {
          data.key = key = `${key}.${Date.now()}`
          needUpdate = true
        }
      }

      if (!data.path) {
        data.path = data.root_id || DEFAULT_ROOT_ID
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
   * access token 有效期 5h
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

    let { headers } = await request(url, {
      responseType: 'text',
      followRedirect: false,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
      },
    })

    let cookie = headers['set-cookie']
    let obj = new URL(headers['location'])
    let origin = obj.origin
    let rootFolder = obj.searchParams.get('id')
    let account = rootFolder
      .split(' ')[0]
      .replace('/Shared', '')
      .replace(/Documents.*?$/, '')

    let query = {
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

    let newurl = `${origin}${account}/_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream?@${qs(query)}`;

    let { data } = await request.post(newurl, {
      data: formdata,
      headers: {
        origin,
        cookie,
        accept: 'application/json;odata=verbose',
        'content-type': 'application/json;odata=verbose',
      },
    })


    if (data?.error) {
      return this.app.error({ message: data.error.message.value })
    }

    if (!data?.ListSchema['.driveAccessToken']) {
      return this.app.error({ message: '请将分享文件夹设置[拥有链接的任何人都可编辑] / The shared folder must be given editing permissions' })
    }

    let access_token = data['ListSchema']['.driveAccessToken'].replace('access_token=', '')
    let graph = data['ListSchema']['.driveUrl']
    let expires_at = parseInt(JSON.parse(atob(access_token.split('.')[1]))['exp']) * 1000

    return {
      access_token,
      expires_at,
      graph,
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
    let { client_id, client_secret, redirect_uri, refresh_token, zone, tenant_id, type, key, ...rest } =
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

    let { data } = await this.app.request.post(`${metadata}/oauth2/v2.0/token`, { data: formdata, contentType: 'form' })

    if (data.error) {
      return this.app.error({ message: data.error_description || data.error })
    }

    let expires_at = data.expires_in * 1000 + Date.now()
    return {
      ...rest,
      client_id,
      client_secret,
      zone,
      tenant_id,
      redirect_uri,
      refresh_token: data.refresh_token,
      access_token: data.access_token,
      expires_at,
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
    if (!(credentials.access_token && credentials.expires_at && credentials.expires_at - Date.now() > 2 * 60 * 1000)) {
      credentials = await this.refreshAccessToken(credentials)

      await this.app.saveDrive({ key, refresh_token: credentials.refresh_token })

      this.clientMap[key] = { ...credentials }
    }

    if (!credentials.graph) {
      credentials.graph = this.getGraphEndpoint(credentials.zone, credentials.site_id)
    }
    return credentials
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
      required: true,
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
}


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

  async getCredentials(key) {
    return await this.manager.getCredentials(key)
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
   *
   * docs: https://docs.microsoft.com/zh-cn/onedrive/developer/rest-api/api/driveitem_list_children?view=odsp-graph-online
   * TODO: there are two methods for request
   * With a known id:  GET /drives/{drive-id}/items/{item-id}/children
   * With a known path: GET /drives/{drive-id}/root:/{path-relative-to-root}:/children
   */
  async list(id, { search, sort }, key) {
    let { graph, access_token } = await this.getCredentials(key)
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

    let { data } = await request.get(url, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: params,
    })

    if (data.error) this.app.error({ message: data.error.message })
    //console.log(data)
    let files = data.value.map((i) => {
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
          parent_id: id //i.parentReference?.id,
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

    return files
  }


  /**
   * get file
   *
   * @param {string} [id] file id
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async get(id, key) {
    let { graph, access_token } = await this.getCredentials(key)

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

    let result = {
      id: data.id,
      name: data.name,
      type: data.folder ? 'folder' : 'file',
      size: data.size,
      ctime: timestamp(data.createdDateTime),
      mtime: timestamp(data.lastModifiedDateTime),
      download_url: data['@microsoft.graph.downloadUrl'] || data['@content.downloadUrl'],
      thumb: data.thumbnails.length > 0 ? data.thumbnails[0].medium.url : '',
      // the download link expires after 3600s
      max_age: 3600 * 1000,
      extra: {
        fid: data.id,
        parent_id: data.parentReference.path.endsWith('root:') ? DEFAULT_ROOT_ID : data.parentReference?.id,
        path: data.parentReference ? data.parentReference.path.split('root:')[1] : '',
      },
    }

    return result
  }

  /**
   * create folder
   *
   * @param {string} [parent_id] folder id
   * @param {string} [name] folder name
   * @param {object} [options] options
   * @param {object} [options.check_name_mode] 
   * @return {object}
   *
   * @api public
   */
  async mkdir(parent_id, name, { check_name_mode = 'rename' }, key) {
    let { graph, access_token } = await this.getCredentials(key)
    let url = graph + `${parent_id == DEFAULT_ROOT_ID ? '/root' : `/items/${parent_id}`}` + '/children'
    let { data } = await this.app.request.post(url, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        name,
        "folder": {},
        "@microsoft.graph.conflictBehavior": "rename"
      },
      contentType: 'json',
    })

    if (data.error) return this.app.error({ message: data.error.message })

    return {
      id: data.id,
      name,
      parent_id
    }
  }

  /**
   * rename file/folder
   *
   * @param {string} [id] folder id
   * @param {string} [name] folder name
   * @param {object} [options] options
   * @param {object} [options.check_name_mode] 
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async rename(id, name, { check_name_mode = 'rename' }, key) {
    let { graph, access_token } = await this.getCredentials(key)
    let url = graph + (id == DEFAULT_ROOT_ID ? '/root' : `/items/${id}`)

    let { data } = await this.app.request(url, {
      method: 'patch',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        name
      },
      contentType: 'json',
    })

    if (data.error) return this.app.error({ message: data.error.message })
    return {
      id: data.id,
      name,
    }
  }

  /**
   * remove file/folder
   *
   * @param {string} [id] id
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async rm(id, key) {
    let { graph, access_token } = await this.getCredentials(key)
    let filedata = await this.get(id, key)
    let url = graph + `/items/${id}`

    let { data, status } = await this.app.request(url, {
      method: 'delete',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      responseType: 'text'
    })

    if (data.error) return this.app.error({ message: data.error.message })

    return {
      id,
      parent_id: filedata.extra.parent_id
    }
  }

  /**
   * move file/folder
   *
   * @param {string} [id] folder id
   * @param {string} [target_id] dest folder
   * @param {string} [key] key
   * @return {object}
   *
   * @api public
   */
  async mv(id, target_id, key) {

    let { graph, access_token } = await this.getCredentials(key)
    let url = graph + `/items/${id}`

    let filedata = await this.get(id, key)
    let { data } = await this.app.request(url, {
      method: 'patch',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        "parentReference": {
          "id": target_id || 'root'
        },
      },
      contentType: 'json',
    })
    if (data.error) return this.app.error({ message: data.error.message })

    return {
      id: data.id,
      name: data.name,
      parent: target_id,
    }
  }

  async singleUpload(id, { size, name, stream, ...rest }, key) {
    let { graph, access_token } = await this.getCredentials(key)
    let url = `${graph}${id == DEFAULT_ROOT_ID ? '/root' : `/items/${id}`}:/${encodeURIComponent(name)}:/content`
    // console.log(url)
    let { data } = await this.app.request(url, {
      method: 'put',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'content-type': 'application/octet-stream'
      },
      data: stream,
      contentType: 'stream',
    })
    if (data.error) return this.app.error({ message: data.error.message })

    return { id: data.id, name: data.name, parent_id: id }
  }
  /**
   * upload file
   *
   * @param {string} [id] folder id
   * @param {object} [options] upload file meta
   * @param {number} [options.size] upload file size
   * @param {string} [options.name] upload file name
   * @param {ReadableStream} [options.stream] upload file stream
   * @param {object} [credentials] credentials
   * @return {string | error}
   *
   * @api public
   */
  async upload(id, { size, name, stream, ...rest }, key) {
    if (size <= UPLOAD_PART_SIZE) {
      return await this.singleUpload(id, { size, name, stream, ...rest }, key)
    }
    const app = this.app

    let { graph, access_token } = await this.getCredentials(key)

    let { data } = await app.request(graph + (id == DEFAULT_ROOT_ID ? '/root' : `/items/${id}`) + `:/${encodeURIComponent(name)}:/` + '/createUploadSession', {
      method: 'post',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        item: {
          "@microsoft.graph.conflictBehavior": "rename",
          // name
        }
      },
      contentType: 'json',
    })
    if (data.error) app.error({ message: data.error.message })

    // expirationDateTime 5d
    let { uploadUrl, expirationDateTime } = data

    let passStream = app.createReadStream(stream, { highWaterMark: 2 * UPLOAD_PART_SIZE_LARGE })

    let part = Math.ceil(size / UPLOAD_PART_SIZE_LARGE)
    let point = 0
    for (let i = 0; i < part; i++) {
      let buffer = await passStream.read(UPLOAD_PART_SIZE_LARGE)
      let res = await app.request(uploadUrl, {
        method: 'put',
        data: buffer,
        contentType: 'buffer',
        // responseType: 'text',
        headers: {
          'Content-Range': `bytes ${point}-${point + buffer.length - 1}/${size}`,
          'Content-Length': buffer.length,
        }
      })
      point += buffer.length
      if (res.status != 201 && res.status != 202) {
        return this.app.error({ message: 'An error occurred during upload: ' + name })
      }
    }

    return {
      id: data.id,
      name: data.name,
      parent_id: id
    }

  }
}

module.exports = Driver
