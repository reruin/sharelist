const createDB = require('./db')

const qs = require('querystringify')

const { URL } = require('url')

const { watch } = require('@vue-reactivity/watch')

const { reactive } = require('@vue/reactivity')

const { nanoid } = require('nanoid')

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

  proxy_override_content_type: 1,
  webdav_proxy: true,

  webdav_user: 'admin',

  webdav_pass: 'sharelist',

  ocr_server: '',

  drives: [],

  manage_path: '/@manage/',

  proxy_url: '',

  plugin_source: 'unpkg',

  default_ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
}

exports.openConfigKey = ['manage_path']

exports.defaultConfigKey = Object.keys(defaultConfig)

const decode = (p) => {
  let hasProtocol = p.includes('://')
  if (!hasProtocol) p = 'sharelist://' + p
  let data = new URL(p)
  let protocol = data.protocol.replace(':', '')
  let path = decodeURIComponent(data.pathname || '')
  let result = {
    protocol,
    key: data.host,
  }

  if (path) path = path.replace(/^\/+/, '')
  if (hasProtocol) result.protocol = data.protocol.split(':')[0]
  const config = { root: path }
  for (const [key, value] of data.searchParams) {
    config[key] = value
  }
  result.config = config

  return result
}


const encode = (data) => {
  let { protocol, config: { key, root, ...options } } = data

  let pathname = root === undefined || root == '' ? '/' : '/' + root
  let search = qs.stringify(options)
  if (search) search = '?' + search
  let ret = `${key || ''}${pathname}${search}`
  if (protocol) ret = `${protocol}://${ret}`

  return ret
}

exports.createConfig = (path) => {
  let { data, save } = createDB(path, { autoSave: false }, { ...defaultConfig })

  let proxyData = reactive({ ...data, drives: data.drives.map(i => ({ name: i.name, id: i.id || nanoid(), ...decode(i.path) })) })

  watch(proxyData, (nv) => {
    Object.keys(nv).forEach((key) => {
      if (key == 'drives') {
        data.drives = nv.drives.map(i => ({ name: i.name, id: i.id, path: encode(i) }))
      } else {
        data[key] = nv[key]
      }
    })
    save()
  }, { deep: true })

  return proxyData
}
