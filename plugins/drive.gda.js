/*
 * Google Drive API
 * 使用官方API挂载
 * token -x-> generateAuthUrl --code--> getToken 
 */

const name = 'GoogleDriveAPI'

const version = '1.0'

const protocols = ['gda']

const defaultProtocol = 'gda'

const fs = require('fs')

const { google } = require('googleapis')

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const defaultFields = [
  "kind",
  "id",
  "name",
  "mimeType",
  "description",
  "starred",
  "trashed",
  "explicitlyTrashed",
  "trashingUser",
  "trashedTime",
  "parents",
  "properties",
  "appProperties",
  "spaces",
  "version",
  "webContentLink",
  "webViewLink",
  "iconLink",
  "hasThumbnail",
  "thumbnailLink",
  "thumbnailVersion",
  "viewedByMe",
  "viewedByMeTime",
  "createdTime",
  "modifiedTime",
  "modifiedByMeTime",
  "modifiedByMe",
  "sharedWithMeTime",
  "sharingUser",
  "owners",
  "teamDriveId",
  "lastModifyingUser",
  "shared",
  "ownedByMe",
  "capabilities",
  "viewersCanCopyContent",
  "writersCanShare",
  "hasAugmentedPermissions",
  "folderColorRgb",
  "originalFilename",
  "fullFileExtension",
  "fileExtension",
  "md5Checksum",
  "size",
  "quotaBytesUsed",
  "headRevisionId",
  "contentHints",
  "imageMediaMetadata",
  "videoMediaMetadata",
  "isAppAuthorized"
].join(",");

//const credentials = {"installed":{"client_id":"650604298391-8jekhg5o1ckklu2c2e2ure45v1uhhhor.apps.googleusercontent.com","project_id":"reruin","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://www.googleapis.com/oauth2/v3/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"1qMz8U9TClO_DxTAvdwKN7yF","redirect_uris":["urn:ietf:wg:oauth:2.0:oob","http://localhost"]}}

const tokens = {}

const clientMap = {}
const driveMap = {}

module.exports = ({ request, cache, getConfig, querystring , base64 }) => {

  /*
 access_token: 'ya29.Glt8Bk67Yfei-k1cRHDpydpA66xNVGFI1pHeL_8ece536BQDIg9aLn9a9r0OIhdjEwhTUOMdWHWC96evAb0GiXAIYNgLCfHSolij-_1-hQTZr-g_OetoAiwd0N8r',
  refresh_token: '1/pzkDqlnyXzVnkPsfoJIuj1v_VzIAtspI5RTEiH21980',
  scope: 'https://www.googleapis.com/auth/drive',
  token_type: 'Bearer',
  expiry_date: 1545641928033
  */
  const saveAuth = async (key , d) => {
    cache.set(`gd_token@${key}` , d)
  }

  const generateAuthUrl = async (client_id, client_secret, redirect_uri) => {
    const oauth2 = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uri
    )
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      //state: { action: 'auth' }
    })

    clientMap[`${client_id}:${client_secret}`] = oauth2

    return authUrl
  }

  const checkAuth = async (client_id, client_secret, code) => {
    let key = `${client_id}:${client_secret}`
    const oauth2 = clientMap[key]

    let res = await oauth2.getToken(code)
    if (res.tokens) {
      saveAuth(key , res.tokens)
      oauth2.setCredentials(res.tokens)
      driveMap[key] = google.drive({ version: 'v3', oauth2 })
      return res.tokens
    } else {
      return false
    }
  }

  const install = async (client_id, client_secret, redirect_uri) => {
    let authUrl = await generateAuthUrl(client_id, client_secret, redirect_uri)
    return `
      <div class="auth">
        <h3>挂载GoogleDrive</h3>
        <p style="font-size:12px;"><a target="_blank" style="font-size:12px;margin-right:5px;color:#337ab7;" href="${authUrl}">访问此链接</a>完成挂载</p>
      </div>
    `
  }

  //client_id:client_secret@fileid
  const parse = (id) => {
    let tmp = id.split('@')
    let client_id, client_secret, fid, drive
    if (tmp[0]) {
      let pairs = tmp[0].split(':')
      client_id = pairs[0]
      client_secret = pairs[1]
    }
    if (tmp[1]) {
      fid = tmp[1]
    }

    let key = `gd_token@` + client_id + ':' + client_secret
    

    if(!driveMap[key]){
      if (cache.get( key )) {
        let token = cache.get( key )
        if( token ){
          console.log('create drive' , token)
          drive = google.drive({ version: 'v3', oauth2:token })
          driveMap[key] = drive
        }
      }
    }

    return { client_id, client_secret, fid, drive }
  }

  const folder = async (id, { req }) => {
    let resid = `${defaultProtocol}:${id}`
    let params = parse(id)
    //console.log(params , id)

    let redirect_uri = req.href
    let key = `${params.client_id}:${params.client_secret}`

    //处理跳转
    let { query } = req
    if (query.code) {
      let res = await checkAuth(params.client_id, params.client_secret, query.code)
      if (res == false) {
        return {
          id,
          type: 'folder',
          protocol: defaultProtocol,
          body: await install(params.client_id, params.client_secret, redirect_uri)
        }
      } else {
        return { id, type: 'folder', protocol: defaultProtocol, redirect: req.origin + req.path }
      }
    }

    //没有token
    if (!params.drive) {
      return {
        id,
        type: 'folder',
        protocol: defaultProtocol,
        body: await install(params.client_id, params.client_secret, redirect_uri)
      }
    } else {
      return await list(params.drive)
    }
  }

  const file = async (id, data) => {}

  const list = async (drive) => {
    let res
    try{
      res = await drive.files.list({
        pageSize: 1000,
        fields: `nextPageToken, files(id,name,mimeType,size,fileExtension,modifiedTime)`,
      })
    }catch(e){
      console.log(e)
    }

    console.log(res)
    let files = res.data.files
    let children = files.map((file) => {
      return {
        id: file.id,
        name: file.name,
        ext: file.fileExtension,
        protocol: defaultProtocol,
        // parent:i[1][0],
        mime: file.mimeType,
        created_at: file.modifiedTime,
        updated_at: file.modifiedTime,
        size: parseInt(file.size),
        type: file.mimeType.indexOf('.folder') >= 0 ? 'folder' : undefined,
      }
    })

    let resp = { id, type: 'folder', protocol: defaultProtocol }
    resp.children = children
    return resp
  }

  return { name, version, drive: { protocols, folder, file } }
}
