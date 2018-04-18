const service = require('./../models/gdlist')
const base = require('../utils/base')
const request = require('request')
const config = require('../config')

const cache = {}

module.exports = {

  async list(ctx) {
    let result = {
      status: 0,
      data: null,
    }

    let { page = 1 , cat = ''} = ctx.query


    if (page < 1) page = 1

    let data = await service.list(page , cat)

    result.data = data

    result.count = data.length

    ctx.body = result

  },

  async listPage(ctx){
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
      
      await ctx.render('detail',{
        data , url : base_url , parent
      })
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