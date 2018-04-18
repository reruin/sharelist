const config = require('../utils/config')

module.exports = async (ctx , next)=>{
  if(config.data.path && config.data.path.length){
    await next()
  }else{
    ctx.redirect('/install')
  }
}