const base = require('../utils/base')
const request = require('request')
const config = require('../config')
const cache = require('../utils/cache')
const { getVendors } = require('../services/plugin')

module.exports = {

  async home(ctx, next) {

    let token = ctx.request.body.token
    let act = ctx.query.a
    let message, access = !!ctx.session.admin

    if (access) {
      await ctx.render('manage', { access, message, config: config.get(), vendors: getVendors() })
    } else {
      await ctx.render('manage', { access })
    }

    // if(act == 'export'){
    //   ctx.body = config.get()
    // }else{
    //   await ctx.render('manage',{access  , message , config:config.get() , vendors:getVendors()})
    // }
  },

  async api(ctx) {

    let body = ctx.request.body
    let a = body.a
    let result = { status: 0, message: 'Success', data: '' , a}

    if (a == 'signin') {
      if (body.token == config.getToken()) {
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
          let { proxy_enable, max_age_dir, max_age_file } = body
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

          if (proxy_enable) {
            proxy_enable = proxy_enable == '1' ? 1 : 0
            opts.proxy_enable = proxy_enable
          }

          await config.save(opts)
          result.message = 'Success'
        }
      }

    }
    ctx.body = result
  }

}
