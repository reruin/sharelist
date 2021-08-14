
const ignore = require('ignore')

const isForbiddenPath = (p) => {
  return false
}

const isIgnorePath = (p = '', config) => {
  p = p.replace(/^\//, '')
  return p && ignore().add([].concat(config.acl_file, config.ignores)).ignores(p)
}

const isProxyPath = (p, config) => {
  p = p.replace(/^\//, '')
  return p && config.proxy_enable && ignore().add(config.proxy_paths).ignores(p)
}

exports.getFiles = async (sharelist, runtime) => {
  let { config } = sharelist

  //使用路径模式，提前排除
  if (runtime.path && isIgnorePath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  if (runtime.path && isForbiddenPath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  if (!config.index_enable) {
    return { error: { code: 403 } }
  }

  const data = await sharelist.list(runtime)

  if (data.err) {
    return { error: { code: data.err.code || 500, msg: data.err.msg } }
  }

  if (data.files?.length > 0) {
    let base_url = runtime.path == '/' ? '' : runtime.path
    data.files = data.files
      .filter(i =>
        !isIgnorePath(decodeURIComponent(base_url + '/' + i.name).substring(1), config)
        &&
        i.hidden !== true
      )
    return data
  }

  return data
}

exports.getFile = async (sharelist, runtime) => {
  let { config } = sharelist

  //使用路径模式，提前排除
  if (runtime.path && isIgnorePath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  if (runtime.path && isForbiddenPath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  const data = await sharelist.get(runtime)

  if (data.err) {
    return { error: { code: data.err.code || 500, msg: data.err.msg } }
  }

  return data
}
