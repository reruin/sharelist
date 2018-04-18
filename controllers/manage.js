const service = require('./../models/gdlist')
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
        message = '密码错误'
      }
      
    }
    await ctx.render('manage',{access  , message , config:config.data})
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
      let { name , path  } = ctx.request.body
      
      if(Array.isArray(name)){
        path = name.map((i ,index)=>{
          return { name:i , path:path[index]}
        })
      }else{
        path = [{name , path}]
      }

      let result = { status : 0 , message : ''}

      if( path ){
        await config.save( { path } )
        message = '保存成功'
      }else{
        message = '请填写完整'
      }
    }
    else if( act == 'token'){
      let newtoken  = ctx.request.body.token
      if(newtoken){
        await config.save( { token:newtoken } )
        message = '口令修改成功'
        ctx.redirect('/manage')
        return
      }else{
        message = '请填写新口令'
      }
    }else if(act == 'clear_cache'){
      cache.clear()
      message = '成功清除缓存'
    }

    await ctx.render('manage',{ message , access : true , config:config.data})
    
  }


}