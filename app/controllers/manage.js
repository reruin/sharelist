const base = require('../utils/base')
const request = require('request')
const config = require('../config')
const cache = require('../utils/cache')
const { getVendors , reload } = require('../services/plugin')
const service = require('../services/sharelist')

/**
 * Hanlders hub
 * 
 * @param {string} [a] action
 * @param {object} [body] formdata
 * @param {object} [ctx] ctx
 * @return {object}
 */
const handlers = async (a, body , ctx) => {
  let result = { status: 0, message: 'Success', data: '', a }

  if (a == 'path') {
    let { name, path, vendor } = body

    if (Array.isArray(name)) {
      path = name.map((i, index) => {
        return { name: i, path: vendor[index] + ':' + path[index] }
      })
    } else {
      path = [{ name, path: vendor + ':' + path }]
    }

    let result = { status: 0, message: '' }

    if (path) {
      await config.save({ path })
      result.message = 'Success'
    } else {
      result.message = 'Invalid Arguments'
    }
  } else if(a == 'plugin_option'){
    console.log(body)
    for(let i in body){
      if(i!=='a'){
        let value = config.getPluginOption(i)
        console.log(value)
        value.value = body[i]
        config.setPluginOption(i , value)
      }
    }

  } else if (a == 'token') {
    let newtoken = body.token
    if (newtoken) {
      await config.save({ token: newtoken })
      ctx.session.admin = false
      result.message = 'Success'
    } else {
      result.status = -1
      result.message = 'Invalid password'
    }
  } else if(a == 'reboot'){
    reload()
    result.message = 'Success'
  }
  else if(a == 'signout'){
    ctx.session.admin = false
    result.message = 'Success'
  } else if (a == 'title') {
    let title = body.title
    if (title) {
      await config.save({ title: title })
      result.message = 'Success'
    } else {
      result.status = -1
      result.message = 'Invalid Title'
    }
  } else if (a == 'clear_cache') {
    cache.clear()
    result.message = 'Success'
  } else if (a == 'cfg') {
    let { proxy_enable, preview_enable, readme_enable, max_age_dir, max_age_file,max_age_download, webdav_path, anonymous_uplod_enable, ignore_file_extensions , ignore_paths , custom_style , custom_script , proxy_paths , proxy_server , ocr_server , language, anonymous_download, index_enable } = body
    let opts = {}
    if (max_age_dir !== undefined) {
      max_age_dir = parseInt(max_age_dir)
      if (!isNaN(max_age_dir)) {
        opts.max_age_dir = max_age_dir * 1000
      }
    }

    if (max_age_file) {
      max_age_file = parseInt(max_age_file)
      if (!isNaN(max_age_file)) {
        opts.max_age_file = max_age_file * 1000
      }
    }

    if (max_age_download) {
      max_age_download = parseInt(max_age_download)
      if (!isNaN(max_age_download)) {
        opts.max_age_download = max_age_download * 1000
      }
    }

    if (proxy_enable) {
      proxy_enable = proxy_enable == '1' ? 1 : 0
      opts.proxy_enable = proxy_enable
    }

    if (preview_enable) {
      preview_enable = preview_enable == '1' ? 1 : 0
      opts.preview_enable = preview_enable
    }
    if (index_enable) {
      index_enable = index_enable == '1' ? 1 : 0
      opts.index_enable = index_enable
    }

    if (readme_enable) {
      readme_enable = readme_enable == '1' ? 1 : 0
      opts.readme_enable = readme_enable
    }

    if (anonymous_uplod_enable) {
      anonymous_uplod_enable = anonymous_uplod_enable == '1' ? 1 : 0
      opts.anonymous_uplod_enable = anonymous_uplod_enable
    }
    
    if (webdav_path) {
      opts.webdav_path = webdav_path
    }

    if(language !== undefined){
      opts.language = language
      //console.log(ctx,ctx.__setLocale)
      ctx.__setLocale(language)
    }

    opts.custom_script = custom_script
    opts.custom_style = custom_style
    opts.ignore_paths = config.getConfig('ignore_paths')
    opts.ignore_file_extensions = ignore_file_extensions
    opts.ignore_paths.__root__ = ignore_paths.split(',')
    opts.proxy_paths = proxy_paths.split(',')
    opts.proxy_server = proxy_server
    opts.anonymous_download = anonymous_download
    opts.ocr_server = ocr_server || ''

    await config.save(opts)
    result.message = 'Success'
  }

  return result
}

module.exports = {

  /**
   * Manage page index handler
   */
  async home(ctx, next) {

    let token = ctx.request.body.token
    let act = ctx.query.a
    let message, access = !!ctx.session.admin

    if (access) {
      if (act == 'export') {
        ctx.body = JSON.stringify(config.getAllConfig())
      } else {
        await ctx.renderSkin('manage', { access, message, config: config.getAllConfig(), vendors: getVendors() })
      }
    } else {
      await ctx.renderSkin('manage', { access })
    }

  },

  /**
   * API router handler
   */
  async api(ctx) {

    let body = ctx.request.body
    let a = body.a
    let result = { status: 0, message: 'Success', data: '', a }

    if (a == 'signin') {
      if (body.token == config.getConfig('token')) {
        ctx.session.admin = true
        result.a = a
        result.message = 'Success'
      } else {
        result.status = -1
        result.message = 'Invalid Password'
      }
    } else {
      if (!ctx.session.admin) {
        result.status = 403
        result.message = 'Require Auth'
      } else {
        result = await handlers(a, body , ctx)
      }

    }
    ctx.body = result
  },

  async api_token(ctx) {
    const { token } = ctx.params
    let body = ctx.request.body
    let act = body.a || ctx.query.a
    let result = { status: 0, message: 'Success', data: '', a: act }

    if (token == config.getConfig('token')) {
      if (act == 'export') {
        ctx.body = JSON.stringify(config.getAllConfig())
        return
      } else {
        result = await handlers(act, body,ctx)
      }
    } else {
      result.status = -1
      result.message = 'error'
    }
    ctx.body = result

  },

  /**
   * Shell page handler
   */
  async shell(ctx){
    let access = !!ctx.session.admin
    if(access){
      await ctx.renderSkin('shell')
    }else{
      ctx.redirect('/manage')
    }
  },

  /**
   * Shell exection
   * 
   * @param {object} [ctx]
   * @return {void}
   */
  async shell_exec(ctx){
    let body = ctx.request.body
    let { command , path = '/' } = body
    if(command){
      let ret = await service.exec(command , path)
      ctx.body = ret
    }
  }
}
