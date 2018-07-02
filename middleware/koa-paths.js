const parse_path = require('../utils/base').parse_path

module.exports = async(ctx, next) => {
  if (!ctx.session.access) {
    ctx.session.access = new Set()
  }
  let url = ctx.request.path.substring(1)
  let [paths, paths_raw] = parse_path(url)
  ctx.paths = paths
  ctx.paths_raw = paths_raw

  await next()
}