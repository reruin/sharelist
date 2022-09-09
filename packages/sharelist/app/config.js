
const path = require('path')

const appInfo = {
  baseDir: path.join(__dirname, '../'),
  pkg: !!process.pkg,
  dev: process.env.NODE_ENV === 'dev'
}

module.exports = {
  env: appInfo,
  cacheDir: path.join(appInfo.pkg ? process.cwd() : appInfo.baseDir, './cache'),
  pluginDir: /*appInfo.dev ? path.join(process.cwd(), '../sharelist-plugin/lib') : */path.join(appInfo.baseDir, './plugin'),
  themeDir: [path.join(appInfo.baseDir, './web'), path.join(appInfo.pkg ? process.cwd() : appInfo.baseDir, './cache/theme')],
  manageDir: path.join(appInfo.baseDir, './manage'),
}