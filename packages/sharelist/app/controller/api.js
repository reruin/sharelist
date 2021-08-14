const { createRuntime, selectSource, send, sendfile } = require('./shared')
const path = require('path')
const fs = require('fs')

const getConfig = (app) => {
  let { sharelist, controller } = app
  let config = { ...sharelist.config }
  if (config.drives) {
    config.drives = sharelist.getDisk()
  }

  config.drivers = sharelist.getDrivers()

  config.guide = {}

  config.drivers.forEach((i) => {
    if (app.guide[i.protocol]) {
      config.guide[i.protocol] = app.guide[i.protocol]
    }
  })

  return config
}

const getFilePath = (file, app) => {
  return path.join(
    app.appInfo.baseDir,
    './theme',
    app.sharelist.config.theme || 'default',
    file,
  )
}

module.exports = {
  async page(ctx, next) {
    let filepath = getFilePath(ctx.path == '/' ? 'index.html' : ctx.path.substring(1), this.app)
    try {
      if (!fs.existsSync(filepath)) {
        filepath = getFilePath('index.html', this.app)
      }
    } catch (e) {
      filepath = getFilePath('index.html', this.app)
    }

    let status = await sendfile(ctx, filepath)
    if (!status) {
      return await this.list(ctx, next)
    }
  },
  async config(ctx, next) {
    let config = getConfig(this.app)
    ctx.body = { data: { title: config.title } }
  },
  async setting(ctx, next) {
    ctx.body = { data: getConfig(this.app) }
  },

  async updateSetting(ctx, next) {
    let data = { ...ctx.request.body }
    for (let i in data) {
      let val = data[i]
      if (i == 'drives') {
        this.app.sharelist.setDisk(val)
      }
      this.app.sharelist.config[i] = val
    }
    // this.app.sharelist.configUpdated()

    ctx.body = { data: getConfig(this.app) }
  },

  async clearCache(ctx, next) {
    this.app.sharelist.cache.clear()
    ctx.body = { status: 0 }
  },

  async get(ctx, next) {
    let sharelist = this.app.sharelist
    let runtime = await createRuntime(ctx)
    let data = await sharelist.getFile(runtime)

    if (data.type == 'file') {
      if (runtime.query.download) {
        await send(ctx, this.app, data)
      } else if (runtime.query.preview) {
        if (data.extra.category == 'video' && data.extra.sources?.length > 0) {
          //let download_url = selectSource(data.extra.sources) || data.download_url
          //await send(ctx, sharelist, { ...data, download_url })
        } else {
          await send(ctx, this.app, data)
        }
      } else {
        ctx.body = data
      }
    } else {
      ctx.body = data
    }
  },
  async list(ctx, next) {
    let sharelist = this.app.sharelist
    let runtime = await createRuntime(ctx)
    let data = await sharelist.getFiles(runtime)

    if (data.files?.length > 0) {
      data.files
        .sort((a, b) => (a.type == 'folder' ? -1 : 1))
        .forEach((i) => {
          if (i.type == 'file') {
            i.download_url = ctx.origin + '/api/drive/get?download=true&id=' + encodeURIComponent(i.id)
            // i.preview_url = ctx.origin + '/api/drive/' + i.path + '?preview=true'
          }
        })
    }
    ctx.body = data
  },
}
