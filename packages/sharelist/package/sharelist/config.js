const createDB = require('./db')

const defaultConfig = {
  token: 'sharelist',

  proxy_enable: false,

  index_enable: true,

  expand_single_disk: true,

  // fast_mode: true,

  max_age_dir: 15 * 60 * 1000,

  max_age_file: 5 * 60 * 1000,

  // max_age_download: 0,

  theme: 'default',

  ignores: [],

  acl_file: '.passwd',

  max_age_download_sign: 'sl_' + Date.now(),

  anonymous_upload_enable: false,

  anonymous_download_enable: true,

  webdav_path: '',
  //代理路径
  proxy_paths: [],

  proxy_server: '',

  webdav_proxy: true,

  webdav_user: 'admin',

  webdav_pass: 'sharelist',

  ocr_server: '',

  drives: [],

  proxy_url: 'https://reruin.github.io/sharelist/redirect.html',
}


exports.defaultConfigKey = Object.keys(defaultConfig)

exports.createConfig = (path) => {
  return createDB(
    path,
    { raw: true },
    {
      ...defaultConfig,
    },
  )
}
