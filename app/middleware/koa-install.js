const config = require('../config')

module.exports = async (ctx , next)=>{
  if(config.getPath().length){
    await next()
  }else{
    if( ctx.path != '/install'){
      ctx.redirect('/install')
    }
  }
}