const base = require('../utils/base')
const request = require('request')
const config = require('../config')
const cache = require('../utils/cache')

module.exports = {

  async home(ctx , next){
    if(config.installed() ){
      ctx.redirect('/')
    }
    else{
      await ctx.render('install')
    }
  }
  ,
  async save(ctx){
    let { token , name , path , provider} =  ctx.request.body
    let cfg = {token}
    if(Array.isArray(name)){
      cfg.path = name.map((i ,index)=>{
        return { name:i , path:provider[index]+'://'+path[index]}
      })
    }else{
      cfg.path = [{name , path:provider+'://'+path}]
    }
    let result = { status : 0 , message : ''}
    if( token && path ){
      await config.save( cfg )
      ctx.redirect('/')
    }else{
      result.status = -1
      result.message = '请填写完整'
      await ctx.render('install',result)
    }
  }

}