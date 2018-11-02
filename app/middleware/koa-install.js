const config = require('../config')

module.exports = async (ctx , next)=>{
  if(config.data.path && config.data.path.length){
    await next()
  }else{
    console.log(ctx.method , ctx.path)
    if( ctx.path != '/install'){
      ctx.redirect('/install')
    }
  }
}