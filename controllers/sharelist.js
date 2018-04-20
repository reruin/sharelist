const service = require('./../models/index')
const base = require('../utils/base')
const request = require('request')
const cache = {}

module.exports = {

  async index(ctx){
    let data = await service.path(ctx.paths)
    let base_url = ctx.url == '/' ? '' : ctx.url
    let parent = ctx.paths.length ? ('/' + ctx.paths.slice(0,-1).join('/')) : ''
    
    if( data === false){
      ctx.status = 404
    }
    else if(Array.isArray(data)){
      await ctx.render('index',{
        data , url : base_url , parent
      })
    }else{
      let act = ctx.request.querystring
      if(act == 'preview'){
        await ctx.render('detail',{
          data , url : base_url , parent
        })
      }
      else if(act == 'proxy'){
        ctx.body = ctx.req.pipe(request(url))
      }
      else{
        ctx.redirect( data.url )
      }
      
    }
    
  }
}