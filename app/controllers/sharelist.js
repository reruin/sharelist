const fs = require('fs')
const request = require('request')

const service = require('../services/sharelist')
const http = require('../utils/http')
const config = require('../config')
const { sendFile , sendHTTPFile } = require('../utils/sendfile')
const cache = {}
const { parsePath , pathNormalize , enablePreview, enableRange , isRelativePath} = require('../utils/base')

const requireAuth = (data) => !!(data.children && data.children.find(i=>(i.name == '.passwd')))

const output = async (ctx , data)=>{

  const isPreview = ctx.request.querystring.indexOf('preview') >= 0

  const isProxy = config.getConfig().proxy_enable || data.proxy

  let url = data.url
   
  if(isPreview){
    //代理 或者 文件系统
    await ctx.render('detail',{
      data , url : isProxy ? ctx.path : url
    })
  }
  //三种方式 , file  | redirect | url
  else{
    if(data.outputType === 'file'){
      await sendFile(ctx, url)
    }
    
    else if( data.outputType == 'redirect'){
      ctx.redirect( url )
    }
    
    else{
      if(isProxy){
        await sendHTTPFile(ctx , url , data.headers || {})
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
      await ctx.render('custom',{
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
        await ctx.render('auth',{
          parent , 
          id:data.protocol+':'+data.id , 
          name:decodeURIComponent(ctx.paths[ctx.paths.length-1] || '')
        })
        
      }else{
        let resp = []
        data.children.forEach((i)=>{
          if(i.ext != 'passwd'){
            let href = ''
            if( i.url && isRelativePath(i.url) ){
              href = pathNormalize(base_url + '/' + i.url)
            }else{
              href = pathNormalize(base_url + '/' + encodeURIComponent(i.name))
            }

            if(enablePreview(i.type)){
              href += (href.indexOf('?')>=0 ? '&' : '?') + 'preview'
            }

            if(i.hidden !== true)
              resp.push( { href , type : i.type , size: i.displaySize , updated_at:i.updated_at , name:i.name})
          }
        })

        if( !ctx.webdav ){
          await ctx.render('index',{
            data:resp , base_url , parent
          })
        }

      }
      
    }else{
      await output(ctx , data)
    }
    
  },

  async api(basePath , paths , query){
    let data = await service.path(paths , query , paths)
    let base_url = basePath 
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
          obj.href = pathNormalize(base_url + '/' + i.url)
        }else{
          obj.href = pathNormalize(base_url + '/' + encodeURIComponent(i.name))
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

    // console.log( hit , 'hit')
    //需要验证
    if( ra ){
      let access = await service.auth(data , user , passwd )
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