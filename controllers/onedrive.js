const service = require('./../models/onedrive')
const base = require('../utils/base')
const request = require('request')
const cache = {}

module.exports = {

  async index(ctx){
    let d = await service.folder('87AA1ADB14DC379A!925')
    ctx.body = 'success'
    return
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
    
  },

  async link(ctx) {
    let reallink = ''

    let id  = ctx.params.id

    let url = await service.link(id)

    let act = ctx.query.output

    if( miss ){
      if( act == 'json'){
        ctx.body = {status : -1 , message : "can't find"}
      }else{
        ctx.body = "can't find this file"
      }
    }else{
      if( act == 'proxy' ){
        ctx.body = ctx.req.pipe(request(reallink))
      }
      else if(act == 'raw'){
        ctx.body = reallink
      }
      else if(act == 'json'){
        ctx.body = {status : 0, url : reallink , ext , title}
      }
      else if(act == 'preview'){
        ctx.body = output(reallink , ext)
      }
      else{
        ctx.redirect( reallink )
      }
    }
    
  }
}