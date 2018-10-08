const base = require('../utils/base')
const request = require('request')
const config = require('../config')
const cache = require('../utils/cache')

module.exports = {

  async home(ctx , next){
    
    let token = ctx.params.token
    let act = ctx.query.a
    let message  , access = false

    if( token ){
      if( token == config.data.token ){
        access = true
      }else{
        message = 'Invalid Password'
      }
      
    }

    if(act == 'export'){
      ctx.body = config.data
    }else{
      await ctx.render('manage',{access  , message , config:config.data , providers:config.providers})
    }
  },

  async update(ctx){
    let token = ctx.params.token
    let act = ctx.request.body.a
    let message = '' 

    if(token !== config.data.token){
      ctx.redirect('/manage')
      return
    }

    if(act == 'path'){
      let { name , path , provider  } = ctx.request.body
      
      if(Array.isArray(name)){
        path = name.map((i ,index)=>{
          return { name:i , path:provider[index]+'://'+path[index]}
        })
      }else{
        path = [{name , path:provider+'://'+path}]
      }

      let result = { status : 0 , message : ''}

      if( path ){
        await config.save( { path } )
        message = 'Success'
      }else{
        message = 'Invalid Arguments'
      }
    }
    else if( act == 'token'){
      let newtoken  = ctx.request.body.token
      if(newtoken){
        await config.save( { token:newtoken } )
        message = 'Success'
        ctx.redirect('/manage')
        return
      }else{
        message = 'Invalid password'
      }
    }
    else if( act == 'title'){
      let title  = ctx.request.body.title
      if(title){
        await config.save( { title:title } )
        message = 'Success'
      }else{
        message = ''
      }
    }
    else if(act == 'clear_cache'){
      cache.clear()
      message = 'Success'
    }
    else if(act == 'cfg'){
      let {enabled_proxy , enabled_proxy_header , cache_refresh_dir , cache_refresh_file} = ctx.request.body
      let opts = {}
      if(cache_refresh_dir){
        cache_refresh_dir = parseInt(cache_refresh_dir)
        if(!isNaN(cache_refresh_dir)){
          opts.cache_refresh_dir = cache_refresh_dir * 1000
        }
      }

      if(cache_refresh_file){
        cache_refresh_file = parseInt(cache_refresh_file)
        if(!isNaN(cache_refresh_file)){
          opts.cache_refresh_file = cache_refresh_file * 1000
        }
      }

      if(enabled_proxy){
        enabled_proxy = enabled_proxy == '1' ? 1 : 0
        opts.enabled_proxy = enabled_proxy
      }

      if(enabled_proxy_header){
        enabled_proxy_header = enabled_proxy_header == '1' ? 1 : 0
        opts.enabled_proxy_header = enabled_proxy_header
      }
      await config.save( opts )
      message = 'Success'

    }

    await ctx.render('manage',{ message , access : true , config:config.data , providers:config.providers})
    
  }


}