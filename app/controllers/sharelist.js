const service = require('../services/sharelist')
const config = require('../config')

// const { sendFile , sendHTTPFile } = require('../utils/sendfile')
const { parsePath , pathNormalize , enablePreview, enableRange , isRelativePath , markdownParse , md5 } = require('../utils/base')

const requireAuth = (data) => !!(data.children && data.children.find(i=>(i.name == '.passwd')))

const isProxyPath = (path , paths) => {
  return (
    path == '' ||  path == '/' || 
    paths.length == 0 ||
    paths.some(p => path.startsWith(p))
  ) ? true : false
}

const output = async (ctx , data)=>{

  const isPreview = ctx.runtime.isPreview

  const isforward = ctx.runtime.isForward

  const downloadLinkAge = config.getConfig('max_age_download')

  const proxyServer = config.getConfig('proxy_server')

  const proxy_paths = config.getConfig('proxy_paths') || []

  const isProxy = (config.getConfig('proxy_enable') && isProxyPath(ctx.path , proxy_paths)) || data.proxy || downloadLinkAge > 0 || !!ctx.webdav

  let url = data.url
  //部分webdav客户端不被正常识别
  if( ctx.webdav ){
    data.proxy_headers = {
      // 'upgrade-insecure-requests': '1',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  }

  //返回必要的 url 和 headers
  if(isforward && data){
    if( config.checkAccess(ctx.query.token) ){
      ctx.body = { ...data }
    }else{
      ctx.body = { error:{status:401 , msg:'401 Unauthorized'} }
    }
    
    return
  }

  if(isPreview){
    //代理 或者 文件系统
    await ctx.renderSkin('detail',{
      data : await service.preview(data) , 
      url : isProxy ? (ctx.path + '?' + ctx.querystring.replace(/preview&?/,'')) : url
    })
  }
  else{
    // outputType = { file | redirect | url | stream }
    // ctx , url , protocol , type , data
    if(data.outputType === 'file'){
      await service.stream(ctx , url , data.outputType , data.protocol)
    }
    
    else if( data.outputType == 'redirect'){
      ctx.redirect( url )
    }
    
    else if( data.outputType == 'stream' ){
      await service.stream(ctx , url , data.outputType , data.protocol , data)
    }
    // http
    else{
      if(isProxy){
        if( proxyServer ){
          ctx.redirect( (proxyServer+ctx.path).replace(/(?<!\:)\/\//g,'/') )
        }else{
          await service.stream(ctx , url , 'url' , data.protocol , data)
        }
      }else{
        ctx.redirect( url )
      }
    }
  }
}

module.exports = {
  async index(ctx){
    let downloadLinkAge = config.getConfig('max_age_download')
    let cursign = md5(config.getConfig('max_age_download_sign') + Math.floor(Date.now() / downloadLinkAge))
    //exclude folder
    if( downloadLinkAge > 0 && ctx.query.t && ctx.query.t != cursign ) {
      ctx.status = 403
      return
    }
    
    const data = await service.path(ctx.runtime)

    let base_url = ctx.path == '/' ? '' : ctx.path
    let parent = ctx.paths.length ? ('/' + ctx.paths.slice(0,-1).join('/')) : ''
    let ignoreexts = (config.getConfig('ignore_file_extensions') || '').split(',')
    let ignorefiles = (config.getConfig('ignore_files') || '').split(',')
    let anonymous_uplod_enable = !!config.getConfig('anonymous_uplod_enable')
    let ignorepaths = config.getIgnorePaths()
    let isAdmin = ctx.session.admin

    if( data === false || data === 401){
      ctx.status = 404
    }
    else if(data.type == 'body' || data.body){
      if( typeof data.body == 'object' ){
        ctx.body = data.body
      }else{
        await ctx.renderSkin('custom',{
          body : data.body
        })
      }
    }
    else if(data.type == 'redirect' || data.redirect){
      ctx.redirect(data.redirect)
    }
    else if(data.type == 'folder'){
      let ret = { base_url , parent , data:[] }

      let preview_enable = config.getConfig('preview_enable')

      let sign = md5(config.getConfig('max_age_download_sign') + Math.floor(Date.now() / downloadLinkAge))

      let sort = ctx.runtime.sort

      if(sort){
        if(sort.size){
          let r = sort.size == 'desc' ? 1 : -1
          data.children = data.children.sort((a,b) => a.size > b.size ? r : -r )
        }
        if(sort.time){
          let r = sort.time == 'desc' ? 1 : -1
          data.children = data.children.sort((a,b) => a.updated_at > b.updated_at ? r : -r)
        }
      }

      for(let i of data.children){
        if(
          isAdmin || 
          (i.type == 'folder' && !ignorepaths.includes(base_url + '/' + i.name)) || 
          (i.type != 'folder' && !ignoreexts.includes(i.ext) && !ignorefiles.includes(i.name))){
          let href = ''
          if( i.url && isRelativePath(i.url) ){
            href = pathNormalize(base_url + '/' + i.url)
          }else{
            href = pathNormalize(base_url + '/' + encodeURIComponent(i.name))
          }

          if(await service.isPreviewable(i) && preview_enable){
            href += (href.indexOf('?')>=0 ? '&' : '?') + 'preview'
          }
          if( i.type != 'folder' && downloadLinkAge > 0 ){
            href += (href.indexOf('?')>=0 ? '&' : '?') + 't=' + sign
          }
          
          if(i.hidden !== true)
            ret.data.push( { href , type : i.type , _size:i.size,size: i.displaySize , updated_at:i.updated_at , name:i.name})
        }
      }


      let readme_enable = !!config.getConfig('readme_enable')
      if( readme_enable ){
        let readmeFile = data.children.find(i => i.name.toLocaleUpperCase() == 'README.MD')
        if(readmeFile){
          ret.readme = markdownParse(await service.source(readmeFile.id , readmeFile.protocol))
        }
      }
      
      ret.writeable = data.writeable && (isAdmin || anonymous_uplod_enable)
      
      if( !ctx.webdav ){
        await ctx.renderSkin('index',ret)
      }
    
    }
    else if(data.type == 'auth'){
      await ctx.renderSkin('auth',{
        parent , 
        id:data.protocol+':'+data.id , 
        name:decodeURIComponent(ctx.paths[ctx.paths.length-1] || ''),
        // target:data.target
      })
    }
    else if(data.type == 'auth_response'){
      let result = {status:0 , message:"success" , rurl:ctx.query.rurl}
      if(!data.result){
        result.status = 403
        result.message = '验证失败'
      }
      ctx.body = result
    }
    else{

      if( downloadLinkAge > 0 && ctx.query.t != cursign ) {
        ctx.status = 403
        return
      }

      if( ignoreexts.includes(data.ext) || ignorefiles.includes(data.name) ){
        ctx.status = 404
      }else{
        await output(ctx , data)
      }
    }
    
  },

  async api(ctx){
    let ignoreexts = (config.getConfig('ignore_file_extensions') || '').split(',')
    let ignorefiles = (config.getConfig('ignore_files') || '').split(',')
    let anonymous_uplod_enable = !!config.getConfig('anonymous_uplod_enable')
    let ignorepaths = config.getIgnorePaths()
    let isAdmin = ctx.runtime.isAdmin
    let base_url = ctx.path == '/' ? '' : ctx.path
    
    const data = await service.path(ctx.runtime)

    //data is readonly
    if( data === false || data === 401){
      ctx.status = 404
    }
    else if(data.type == 'body' || data.body || data.type == 'redirect' || data.redirect){
      return {
        type:'folder',
        children:[{id:'error' , name:'此页面无法在WebDAV中显示' , type:'txt'}]
      }
    }
    else if(data.type == 'auth'){
      return data
    }
    else if(data.type == 'folder'){
      let base_url = ctx.path == '/' ? '' : ctx.path
      let ret = { ...data }
      ret.children = data.children
      .filter(i => 
        (
          (
            i.type != 'folder' && 
            !ignoreexts.includes(i.ext) && 
            !ignorefiles.includes(i.name) 
          ) || 
          (
            i.type == 'folder' &&  !ignorepaths.includes(base_url + '/' + i.name)
          )
        ) &&
        i.hidden !== true
      )
      .map(i => {
        let obj = { ...i }
        if( i.url && isRelativePath(i.url) ){
          obj.href = pathNormalize(base_url + '/' + i.url)
        }else{
          obj.href = pathNormalize(base_url + '/' + encodeURIComponent(i.name))
        }
        return obj
      })
      
      return ret
    }
    else{
      if( ignoreexts.includes(data.ext) || ignorefiles.includes(data.name) ){
        ctx.status = 404
      }else{
        if(ctx.runtime.method == 'GET'){
          await output(ctx , data)
        }else{
          return data
        }
      }
    }
    
  },
}