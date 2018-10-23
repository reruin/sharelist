const parsePath = require('../utils/base').parsePath

module.exports = async(ctx, next) => {
  if (!ctx.session.access) {
    ctx.session.access = new Set()
  }
  let url = ctx.request.path.substring(1).replace(/\/$/,'')
  let [paths, paths_raw] = parsePath(url)
  ctx.paths = paths
  ctx.paths_raw = paths_raw

  await next()
}