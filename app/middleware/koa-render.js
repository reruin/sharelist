const { getSkin } = require('../config')

module.exports = (ctx, next) => {
  if(ctx.renderSkin) return next()
  ctx.response.renderSkin = ctx.renderSkin = (path , options) => {
    return ctx.render(getSkin()+'/'+path, options)
  }
  return next()
}