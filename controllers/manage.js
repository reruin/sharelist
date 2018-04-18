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
      if( token == config.token ){
        access = true

        if(act == 'clear_cache'){
          cache.clear()
          message = '成功清除缓存'

        }
        else if(act == 'signout'){
          access = false
          ctx.redirect('/manage')
          return
        }
      }else{
        message = '密码错误'
      }
      
    }
    await ctx.render('manage',{access  , message})

  }


}