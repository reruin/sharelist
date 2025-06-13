
const ignore = require('ignore')
const crypto = require('crypto')
const { pluginConfigKey } = require('./plugin')

//过滤config 项目
const filterConfig = (config) => {
  let ret = {}
  for (let i of pluginConfigKey) {
    if (config[i]) ret[i] = config[i]
  }
  return ret
}

//TODO 过滤屏蔽路径
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

exports.md5 = content => crypto.createHash('md5').update(content).digest("hex")

exports.getFiles = async (driver, config, runtime) => {
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
    data = await driver.list(runtime)
  } catch (e) {
    console.trace(e)
    return { error: { ...e, code: e.code || 500, message: e.message } }
  }

  if (data.files?.length > 0) {
    let base_url = runtime.path == '/' ? '' : runtime.path

    data.files = data.files
      .filter(i =>
        !isIgnorePath((base_url + '/' + i.name).substring(1), config)
        &&
        i.hidden !== true
      )

    if (!runtime.params.search) {
      data.files.forEach((i) => {
        //路径，相对于drive的绝对路径
        // TODO 搜索结果 应在 web端忽略path 内容
        i.path = i.extra?.path ? [runtime.driveName, i.extra?.path].join('/').replace(/\/{2,}/g, '/') : i.path

        if (i.config) {
          i.config = filterConfig(i.config)
        }
      })
    }

  }


  if (data.config) {
    // console.log('SET data config', runtime.driveName)
    data.config = filterConfig(data.config)
    data.config.drive = runtime.driveName
  }

  return { data }

}

exports.getFile = async (driver, config, runtime) => {

  //使用路径模式，提前排除
  if (runtime.path && isIgnorePath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  if (runtime.path && isForbiddenPath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  let data
  try {
    data = await driver.get(runtime)
  } catch (e) {
    return { error: { code: e.code || 500, msg: e.message } }
  }

  return { data }
}


exports.getPathById = async (driver, config, runtime) => {

  //使用路径模式，提前排除
  if (runtime.path && isIgnorePath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  if (runtime.path && isForbiddenPath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  let data
  try {
    data = await driver.pwd(runtime.id)
  } catch (e) {
    return { error: { code: e.code || 500, msg: e.message } }
  }

  return { data }
}

exports.getContent = async (driver) => {

}

exports.getDownloadUrl = async (config, driver, runtime) => {
  //使用路径模式，提前排除
  if (runtime.path && isIgnorePath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  if (runtime.path && isForbiddenPath(runtime.path, config)) {
    return { error: { code: 404 } }
  }

  try {
    let { url } = await driver.get_download_url(runtime)
    return { url }

  } catch (error) {
    return { error }
  }
}

exports.isUrl = (s) => {
  try {
    let parsed = new URL(s)
    return parsed.protocol == 'http:' || parsed.protocol == 'https:'
  } catch (err) {
    return false;
  }
}
