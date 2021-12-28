
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

  let data
  try {
    data = await sharelist.list(runtime)
  } catch (e) {
    //console.trace(e)
    return { error: { code: e.code || 500, message: e.message } }
  }
  if (data.files?.length > 0) {
    let base_url = runtime.path == '/' ? '' : runtime.path
    data.files = data.files
      .filter(i =>
        !isIgnorePath(decodeURIComponent(base_url + '/' + i.name).substring(1), config)
        &&
        i.hidden !== true
      )
  }
  return { data }

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

  let data
  try {
    data = await sharelist.get(runtime)
  } catch (e) {
    return { error: { code: e.code || 500, msg: e.message } }
  }

  return { data }
}

exports.getDownloadUrl = async (runtime) => {
  //使用路径模式，提前排除
  if (runtime.path && isIgnorePath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  if (runtime.path && isForbiddenPath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  try {
    let { url } = await sharelist.get_download_url(runtime)
    return { url }

  } catch (error) {
    return { error }
  }

}
