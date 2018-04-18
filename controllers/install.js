const base = require('../utils/base')
const request = require('request')
const config = require('../utils/config')
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
    let { token , path } =  ctx.request.body
    let result = { status : 0 , message : ''}
    if( token && path ){
      await config.save({token , path})
      ctx.redirect('/')
    }else{
      result.status = -1
      result.message = '请填写完整'
      await ctx.render('install',result)
    }
  }

}