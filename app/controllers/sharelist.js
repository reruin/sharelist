const service = require('../services/sharelist')
const config = require('../config')

// const { sendFile , sendHTTPFile } = require('../utils/sendfile')
const { parsePath , pathNormalize , enablePreview, enableRange , isRelativePath} = require('../utils/base')

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
    let data = await service.path(ctx.paths , ctx.query , ctx.paths , ctx.method)
    let base_url = ctx.path == '/' ? '' : ctx.path
    let parent = ctx.paths.length ? ('/' + ctx.paths.slice(0,-1).join('/')) : ''
    //data is readonly
    if( data === false){
      ctx.status = 404
    }
    else if(data === 401){
      ctx.status = 401
    }
    else if(data.body){
      await ctx.renderSkin('custom',{
        body : data.body
      })
    }
    else if(data.redirect){
      ctx.redirect(data.redirect)
      return
    }
    else if(data.type == 'folder'){

      let ra = requireAuth(data)
      if( ra !== false && !ctx.session.access.has( data.id )){
        //验证界面
        await ctx.renderSkin('auth',{
          parent , 
          id:data.protocol+':'+data.id , 
          name:decodeURIComponent(ctx.paths[ctx.paths.length-1] || '')
        })
        
      }else{
        let resp = []
        let preview_enable = config.getConfig('preview_enable')
        for(let i of data.children){
          if(i.ext != 'passwd'){
            let href = ''
            if( i.url && isRelativePath(i.url) ){
              href = pathNormalize(base_url + '/' + i.url)
            }else{
              href = pathNormalize(base_url + '/' + encodeURIComponent(i.name))
            }

            if(await service.isPreviewable(i) && preview_enable){
              href += (href.indexOf('?')>=0 ? '&' : '?') + 'preview'
            }

            if(i.hidden !== true)
              resp.push( { href , type : i.type , size: i.displaySize , updated_at:i.updated_at , name:i.name})
          }
        }

        if( !ctx.webdav ){
          await ctx.renderSkin('index',{
            data:resp , base_url , parent
          })
        }

      }
      
    }else{
      await output(ctx , data)
    }
    
  },

  async api(ctx , base_path = ''){
    const { paths , query } = ctx
    let data = await service.path(paths , query , paths)
    let parent = paths.length ? ('/' + paths.slice(0,-1).join('/')) : ''

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
      ret.children = data.children.map(i => {
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
    
  },

  async auth(ctx){
    let { path , user , passwd } = ctx.request.body
    let [paths , paths_raw] = parsePath(path.substring(1))

    let data = await service.path(paths , ctx.query , paths_raw)
    let result = { status : 0 , message:''}
    let ra = requireAuth(data)

    //需要验证
    if( ra ){
      let access = await service.auth(data , user , passwd)
      if( access ){
        ctx.session.access.add( data.id )
      }else{
        result.status = 403
        result.message = '验证失败'
      }
    }else{
      result.message = '此目录不需要验证'
    }

    ctx.body = result
  }
}