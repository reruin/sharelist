/*
 * Google Drive
 * gd:GoogleDriveID
 */

const name = 'GoogleDrive'

const version = '1.0'

const protocols = ['gd','googledrive']

const defaultProtocol = 'gd'

const host = 'https://drive.google.com'

module.exports = ({ request , getConfig , datetime , cache }) => {

  const createFetchParams = (id , key , maxResults = 99999) => {
    return `openDrive=true&reason=102&syncType=0&errorRecovery=false&q=trashed%20%3D%20false%20and%20%27${id}%27%20in%20parents&fields=kind%2CnextPageToken%2Citems(kind%2CmodifiedDate%2CmodifiedByMeDate%2ClastViewedByMeDate%2CfileSize%2Cowners(kind%2CpermissionId%2CdisplayName%2Cpicture)%2ClastModifyingUser(kind%2CpermissionId%2CdisplayName%2Cpicture)%2ChasThumbnail%2CthumbnailVersion%2Ctitle%2Cid%2Cshared%2CsharedWithMeDate%2CuserPermission(role)%2CexplicitlyTrashed%2CmimeType%2CquotaBytesUsed%2Cshareable%2Ccopyable%2CfileExtension%2CsharingUser(kind%2CpermissionId%2CdisplayName%2Cpicture)%2Cspaces%2Ceditable%2Cversion%2CteamDriveId%2ChasAugmentedPermissions%2CcreatedDate%2CtrashingUser(kind%2CpermissionId%2CdisplayName%2Cpicture)%2CtrashedDate%2Cparents(id)%2Ccapabilities(canCopy%2CcanDownload%2CcanEdit%2CcanAddChildren%2CcanDelete%2CcanRemoveChildren%2CcanShare%2CcanTrash%2CcanRename%2CcanReadTeamDrive%2CcanMoveTeamDriveItem)%2Clabels(starred%2Chidden%2Ctrashed%2Crestricted%2Cviewed))%2CincompleteSearch&appDataFilter=NO_APP_DATA&spaces=drive&maxResults=${maxResults}&orderBy=folder%2Ctitle_natural%20asc&key=${key}`
  }
  // gd folder => files
  const folder = async(id) => {
    let resid = `${defaultProtocol}:${id}`
    let resp = {id , type:'folder' , protocol:defaultProtocol}
    let r = cache.get(resid)
    if(r) {
      resp = r
      if(
        resp.$cached_at && 
        resp.children &&
        ( Date.now() - resp.$cached_at < getConfig('max_age_dir'))

      ){
        console.log('get gd folder from cache')
        return resp
      }
    }


    let { body } = await request.get(host+'/drive/folders/'+id)
    let code = (body.match(/__initData\s*=\s*([\w\W]+?);<\/script>/) || ['',''])[1]
    code = code.replace(/[\r\n]/g,'')
    let server , key;
    if(code){
      try{
        code = JSON.parse(code)
        server = code[0][50][0]
        key = code[0][9][32][35]
      }catch(e){
      }
    }

    let data
    if(server && key){
      let qs = createFetchParams(id , key)
      let url = `${server}/drive/v2beta/files?` + qs
      let resp  = await request.get(url,{ headers:{'referer':`${host}/drive/folders/${id}`}})
      if(resp.body){
        try{
          let r = JSON.parse(resp.body)
          data = r.items;
        }catch(e){
        }
      }
    }

    if( data ){
      const ts = Date.now()
      let children = data ? data.map((i)=>{
        return {
          id:i.id,
          name:i.title,
          ext:i.fileExtension,
          protocol:defaultProtocol,
          parent:id,
          mime:i.mimeType,
          created_at:datetime(i.createdDate),
          updated_at:datetime(i.modifiedDate),
          size:parseInt(i.fileSize),
          type : i.mimeType.includes('.folder') ? 'folder' : undefined,
          $cached_at:ts,
        }
      }) : []


      //folder 额外保存 
      resp.children = children
      resp.$cached_at = ts

      cache.set(resid,resp)
      return resp
    }else{
      return false
    }
    
  } 
  /**
   * 获取文件实际路径
   */
  const file = async(id , data = {}) =>{
    if(
      data && 
      data.$cached_at && 
      data.url &&
      ( Date.now() - data.$cached_at < getConfig('max_age_file'))

    ){
      console.log('get gd file from cache')
      return data
    }


    let reallink = ''
    let { body , headers }  = await request.get(host + '/uc?id='+id+'&export=download',{followRedirect : false})
    if(headers && headers.location){
      reallink = headers.location
    }else{
      let url = (body.match(/\/uc\?export=download[^"']+/i) || [''])[0]
      url = url.replace(/&amp;/g,'&')
      let cookie = headers['set-cookie'].join('; ')
      let resp = await request.get(host + url , {headers:{'Cookie':cookie} , followRedirect : false})
      if(resp.headers && resp.headers.location){
        reallink = resp.headers.location
      }
    }

    data.url = reallink
    data.$cached_at = Date.now()

    //强制保存 ， data 是指向 父级 的引用
    let resid = `${defaultProtocol}:${data.parent}`
    cache.save()
    return data
  }

  return { name , version, drive:{ protocols, folder , file } }
}