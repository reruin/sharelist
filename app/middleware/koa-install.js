const config = require('../config')

module.exports = async (ctx , next)=>{
  if(config.installed()){
    await next()
  }else{
    if( ctx.path != '/install'){
      ctx.redirect('/install')
    }
  }
}