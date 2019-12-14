const service = require('../services/sharelist')
const config = require('../config')

// const { sendFile , sendHTTPFile } = require('../utils/sendfile')
const { parsePath , pathNormalize , enablePreview, enableRange , isRelativePath , markdownParse , md5 } = require('../utils/base')

const requireAuth = (data) => !!(data.children && data.children.find(i=>(i.name == '.passwd')))

const output = async (ctx , data)=>{

  const isPreview = ctx.request.querystring.indexOf('preview') >= 0

  const isProxy = config.getConfig('proxy_enable') || data.proxy

  let url = data.url
   
  if(isPreview){
    //代理 或者 文件系统
    await ctx.renderSkin('detail',{
      data : await service.preview(data) , url : isProxy ? ctx.path : url
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
        await service.stream(ctx , url , 'url' , data.protocol , data)
      }else{
        ctx.redirect( url )
      }
    }
  }
}

module.exports = {
  async index(ctx){
    let downloadLinkAge = config.getConfig('max_age_download')

    if( downloadLinkAge > 0 && ctx.query.t){
        if( ctx.query.t != md5(config.getConfig('max_age_download_sign') + Math.floor(Date.now() / downloadLinkAge)) ) {
          ctx.status = 403
          return
        }
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
            ret.data.push( { href , type : i.type , size: i.displaySize , updated_at:i.updated_at , name:i.name})
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
      let result = {status:0 , message:"success"}
      if(!data.result){
        result.status = 403
        result.message = '验证失败'
      }
      ctx.body = result
    }
    else{
      if( ignoreexts.includes(data.ext) || ignorefiles.includes(data.name) ){
        ctx.status = 404
      }else{
        await output(ctx , data)
      }
    }
    
  },

  async api(ctx , base_path = ''){
    const { paths , query } = ctx
    let data = await service.path(paths , query , paths)
    let parent = paths.length ? ('/' + paths.slice(0,-1).join('/')) : ''
    let ignoreexts = (config.getConfig('ignore_file_extensions') || '').split(',')
    let ignorefiles = (config.getConfig('ignore_files') || '').split(',')
   
    //data is readonly
    if( data === false){
      return { status : 404 }
    }
    else if(data === 401){
      return { status : 404 }
    }

    else if(data.type == 'folder'){
      let ret = { ...data }
      ret.auth = requireAuth(data)
      ret.children = data.children
      .filter(i => (i.ext && !ignoreexts.includes(i.ext)))
      .map(i => {
        let obj = { ...i }
        if( i.url && isRelativePath(i.url) ){
          obj.href = pathNormalize(base_path + '/' + i.url)
        }else{
          obj.href = pathNormalize(base_path + '/' + encodeURIComponent(i.name))
        }
        return obj
      })
      
      return ret
    }
    else{
      return { ...data }
    }
    
  }
}