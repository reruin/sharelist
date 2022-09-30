
const path = require('path')

const env = {
  baseDir: path.join(__dirname, '../'),
  cacheDir: path.join(!process.pkg ? __dirname : process.execPath, '../cache'),
  pkg: !!process.pkg,
  dev: process.env.NODE_ENV === 'dev'
}

module.exports = {
  env,
  cacheDir: env.cacheDir,
  pluginDir: path.join(env.cacheDir, 'plugin'),
  themeDir: [path.join(env.baseDir, 'web'), path.join(env.cacheDir, 'theme')],
  manageDir: path.join(env.baseDir, 'manage'),
  defaultPluginsFile: path.join(env.baseDir, 'plugins.json'),
}