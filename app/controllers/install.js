const base = require('../utils/base')
const request = require('request')
const config = require('../config')
const { getVendors } = require('../services/plugin')

const cache = require('../utils/cache')

module.exports = {

  /**
   * Install index handler
   */
  async home(ctx , next){
    if(config.installed() ){
      ctx.redirect('/')
    }
    else{
      await ctx.renderSkin('install' , {vendors:getVendors()})
    }
  }
  ,
  /**
   * Save config handler
   */
  async save(ctx){
    let { token , name , path , vendor , title = 'ShareList'} =  ctx.request.body
    let cfg = {token , title}
    if(Array.isArray(name)){
      cfg.path = name.map((i ,index)=>{
        return { name:i , path:vendor[index]+':'+path[index]}
      })
    }else{
      cfg.path = [{name , path:vendor+':'+path}]
    }
    let result = { status : 0 , message : ''}
    if( token && path ){
      await config.save( cfg )
      ctx.redirect('/')
    }else{
      result.status = -1
      result.message = 'error'
      await ctx.renderSkin('install',result)
    }
  }

}