const base = require('../utils/base')
const request = require('request')
const config = require('../config')
const cache = require('../utils/cache')
const { getVendors } = require('../services/plugin')

module.exports = {

  async home(ctx , next){
    
    let token = ctx.params.token
    let act = ctx.query.a
    let message  , access = false

    if( token ){
      if( token == config.getToken() ){
        access = true
      }else{
        message = 'Invalid Password'
      }
      
    }

    if(act == 'export'){
      ctx.body = config.get()
    }else{
      await ctx.render('manage',{access  , message , config:config.get() , vendors:getVendors()})
    }
  },

  async update(ctx){
    let token = ctx.params.token
    let act = ctx.request.body.a
    let message = '' 

    if(token !== config.getToken()){
      ctx.redirect('/manage')
      return
    }

    if(act == 'path'){
      let { name , path , vendor  } = ctx.request.body
      
      if(Array.isArray(name)){
        path = name.map((i ,index)=>{
          return { name:i , path:vendor[index]+':'+path[index]}
        })
      }else{
        path = [{name , path:vendor+':'+path}]
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
      let {proxy_enable  , max_age_dir , max_age_file} = ctx.request.body
      let opts = {}
      if(max_age_dir !== undefined){
        max_age_dir = parseInt(max_age_dir)
        if(!isNaN(max_age_dir)){
          opts.max_age_dir = max_age_dir * 1000
        }
      }

      if(max_age_file){
        max_age_file = parseInt(max_age_file)
        if(!isNaN(max_age_file)){
          opts.max_age_file = max_age_file * 1000
        }
      }

      if(proxy_enable){
        proxy_enable = proxy_enable == '1' ? 1 : 0
        opts.proxy_enable = proxy_enable
      }

      await config.save( opts )
      message = 'Success'

    }

    await ctx.render('manage',{ message , access : true , config:config.get() , vendors:getVendors()})
    
  }


}