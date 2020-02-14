const { getSkin , getConfig } = require('../config')

module.exports = (ctx, next) => {
  if(ctx.renderSkin) return next()
  ctx.response.renderSkin = ctx.renderSkin = (path , options) => {
    let data = { ...options , g_config:{
      custom_style:getConfig('custom_style'),
      custom_script:getConfig('custom_script'),
    }}
    return ctx.render(getSkin()+'/'+path, data)
  }
  return next()
}