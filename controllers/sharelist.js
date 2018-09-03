const service = require('./../models/index')
const base = require('../utils/base')
const http = require('../utils/http')
const {encode , decode} = require('../utils/format')
const request = require('request')
const config =require('../config')
const cache = {}
const parse_path = require('../utils/base').parse_path

const auth = (data , ctx)=>{
  
}

module.exports = {
  async index(ctx){
    let data = await service.path(ctx.paths , ctx.query , ctx.paths_raw)
    let base_url = ctx.path == '/' ? '' : ctx.path
    let parent = ctx.paths.length ? ('/' + ctx.paths.slice(0,-1).join('/')) : ''

    //data is readonly
    if( data === false){
      ctx.status = 404
    }
    else if(data === 401){
      ctx.status = 401
    }

    else if(data.type == 'folder'){
      let passwd = base.checkPasswd(data)

      if( passwd !== false && !ctx.session.access.has( data.id )){
        await ctx.render('auth',{parent , id:data.id , name:decodeURIComponent(decode(ctx.paths[ctx.paths.length-1]))})
        
      }else{
        let resp = []
        data.children.forEach((i)=>{
          if(i.ext != 'passwd'){
            let href = i.href || base.path(base_url+'/'+ encode(i.pathname|| i.name ))

            if(['audio','video','image'].indexOf(i.type) >= 0){
              href += (href.indexOf('?')>=0 ? '&' : '?') + 'preview'
            }
            resp.push( { href , type : i.type , name:i.name})
          }
        })

        await ctx.render('index',{
          data:resp , base_url , parent
        })
      }
      
    }else{
      let preview = ctx.request.querystring.indexOf('preview') >= 0
      let download_url = data.url

      let proxy_header_support = (data.type == 'video' || data.type == 'audio')
      console.log( proxy_header_support )
      if(preview){
        if(config.data.enabled_proxy){
          download_url = ctx.path
        }
        await ctx.render('detail',{
          data , download_url
        })
      }
      else{
        if(config.data.enabled_proxy){
          console.log('proxy:',download_url)
          if( (data.proxy_header || config.data.enabled_proxy_header ) && proxy_header_support){

            try{
              let headers = await http.header2(download_url,{headers:{'Range': 'bytes=0-'}})
              // console.log(headers)
              if(headers){
                for(let i in headers){
                  ctx.response.set(i, headers[i])
                }
              }
            }catch(e){
              console.log(e)
            }
          }
          
         ctx.body = ctx.req.pipe(request({url :download_url}))

        }else{
          ctx.redirect( download_url )
        }
      }
      
    }
    
  },

  async api(ctx){
    let token = ctx.params.token
    if(token == config.data.token){
      let data = await service.path(ctx.paths.slice(1))
      let base_url = ctx.url == '/' ? '' : ctx.url
      let parent = ctx.paths.length ? ('/' + ctx.paths.slice(0,-1).join('/')) : ''
      ctx.body = data
    }else{
      ctx.body = []
    }
    
  },

  async auth(ctx){
    let { path , passwd } = ctx.request.body
    let [paths , paths_raw] = parse_path(path.substring(1))

    let data = await service.path(paths , ctx.query , paths_raw)
    let hit = base.checkPasswd(data)
    let result = { status : 0 , message:''}

    console.log( hit , 'hit')
    //需要验证
    if( hit !== false && hit){
      if( hit == passwd ){
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