const fs = require('fs')
const path = require('path')
const { createRuntime, selectSource, send, sendfile, uploadManage, emptyStream, createUpdateManage } = require('./runtime')

module.exports = (sharelist, appConfig) => {

  const getConfig = async (raw = false) => {
    if (raw) return sharelist.config
    let config = { ...sharelist.config }
    // if (config.drives) {
    //   config.drives = sharelist.getDisk()
    // }
    config.drivers = sharelist.driver.getDriver()

    config.theme_options = sharelist.theme.get()

    config.plugin_source_options = sharelist.plugin.getSources()

    config.plugins = sharelist.plugin.get()

    config.guide = appConfig.guide

    config.pluginConfig = sharelist.driver.getPluginConfig()

    return config
  }

  const getCustomConfig = () => {
    const ret = {}
    const defaultConfigKey = sharelist.defaultConfigKey
    const config = { ...sharelist.config }
    for (let i of Object.keys(config)) {

      if (!defaultConfigKey.includes(i)) {
        ret[i] = config[i]
      }
    }
    ret.version = appConfig.version
    return ret
  }

  const getManageFile = (file) => {
    console.log(appConfig, '**')
    if (appConfig.manageDir) {
      return path.join(appConfig.manageDir, file)
    } else {
      return ''
    }
  }

  const get = async (runtime) => {
    let { data, error } = await sharelist.file(runtime)

    if (error) {
      return { error }
    }

    if (data.type == 'file') {
      if (runtime.params.download) {
        if (runtime.params.preview) {
          if (data.extra.preview_url) {
            return await send(sharelist, { ...data, download_url: data.extra.preview_url, reqHeaders: runtime.headers })
          }
          else if (data.extra.sources) {
            let download_url = selectSource(data.extra.sources, runtime.params.preview) || data.download_url
            return await send(sharelist, { ...data, download_url, reqHeaders: runtime.headers })
          } else {
            return await send(sharelist, { ...data, reqHeaders: runtime.headers })
          }
        } else {
          if (sharelist.config.anonymous_download_enable) {
            return await send(sharelist, { ...data, reqHeaders: runtime.headers })
          }
        }

      } else {
        if (!data.download_url || data.extra?.proxy) {
          data.download_url = '/api/drive/get?download=true&id=' + encodeURIComponent(data.id)
        }
        return data
      }
    } else {
      if (!data.download_url) {
        data.download_url = '/api/drive/get?download=true&id=' + encodeURIComponent(data.id)
      }
      return data
    }

    return { status: 404 }
  }
  const list = async (runtime) => {

    let st = Date.now()

    let { data, error } = await sharelist.files(runtime)
    if (error) {
      return { error }
    } else {
      if (data.files?.length > 0) {
        data.files
          // .sort((a, b) => (a.type == 'folder' ? -1 : 1))
          .forEach((i) => {
            if (i.type == 'file') {
              let download_url = '/api/drive/file/get?download=true&id=' + encodeURIComponent(i.id)
              i.download_url = download_url
              if (i.extra?.preview_url) {
                i.preview_url = download_url + '&preview=true'
              }
              if (i.extra?.sources) {
                i.sources = i.extra.sources.map(i => ({ quality: i.quality, src: download_url + '&preview=' + i.quality }))
              }
            }
          })
      }

      return data
    }

  }

  const updateManage = createUpdateManage(sharelist)

  const manageReplacer = (data) => {
    const basePath = sharelist.config.manage_path
    return data.replace('<head>', `<head><script>window.MANAGE_BASE="${basePath}"</script>`).replace('src="./', `src="${basePath}/`).replace('href="./', `href="${basePath}/`)
  }
  return {
    async page(ctx, next) {
      //let filepath = getFilePath(ctx.path == '/' ? 'index.html' : ctx.path.substring(1), this.app)
      const { getThemeFile, config } = sharelist
      const managePath = config.manage_path || '/@manage'
      if (managePath && ctx.path.startsWith(managePath)) {
        let filepath = ctx.path.replace(managePath, '')
        if (filepath == '' && !ctx.path.endsWith('/')) {
          ctx.redirect(ctx.path + '/')
          return
        }
        filepath = getManageFile((filepath == '/' || filepath == '') ? 'index.html' : filepath)
        let isFileExist = false
        try {
          if (fs.existsSync(filepath)) {
            isFileExist = true
          }
        } catch (e) { }
        if (!isFileExist) {
          filepath = getManageFile('index.html')
        }
        let replacer = filepath.endsWith('index.html') ? manageReplacer : null

        return await sendfile(ctx, filepath, replacer)
      }

      let filepath = getThemeFile(ctx.path == '/' ? 'index.html' : ctx.path.substring(1))

      // if url is '/filename_path?download'
      if ('download' in ctx.query) {
        await get(ctx, next)
      } else {
        try {
          if (!fs.existsSync(filepath)) {
            filepath = getThemeFile('index.html')
          }
        } catch (e) {
          filepath = getThemeFile('index.html')
        }
        console.log(Date.now())

        let status = await sendfile(ctx, filepath)
        if (!status) {
          console.log(Date.now())

          let r = await this.list(ctx, next)
          console.log(Date.now())

          return r
        }
      }

    },

    async setting(ctx, next) {
      ctx.body = { data: await getConfig(!!ctx.query.raw) }
    },
    async userConfig(ctx, next) {
      const data = getCustomConfig()
      ctx.body = { status: 0, data }
    },
    async configField(ctx, next) {
      const data = getCustomConfig()
      const key = ctx.query.key || ctx.params.field
      const ret = key && data[key] ? data[key] : ''
      if (ctx.query['content-type']) {
        ctx.set('content-type', ctx.query['content-type'])
        ctx.body = ret
      } else {
        ctx.body = { status: 0, data: ret }
      }
    },
    async reload(ctx, next) {
      await sharelist.reload()
      ctx.body = { status: 0 }
    },
    async reloadBench(ctx) {
      for (let i = 0; i < 3000; i++) {
        await sharelist.reload()
      }
      ctx.body = { status: 0 }
    },
    async updateSetting(ctx, next) {
      let data = { ...ctx.request.body }
      for (let i in data) {
        let val = data[i]

        if (i == 'drives') {
          sharelist.setDrives(val)
        } else {
          sharelist.config[i] = val
        }
      }

      ctx.body = { data: await getConfig() }
    },

    async getPlugin(ctx, next) {
      const id = ctx.params.id
      const ret = sharelist.plugin.get(id)
      if (ret && ret.path) {
        ctx.body = { status: 0, data: fs.readFileSync(ret.path, 'utf-8') }
      } else {
        ctx.body = { status: 0, data: '' }
      }
    },

    async setPlugin(ctx, next) {
      const { id, data } = ctx.request.body
      try {
        await sharelist.plugin.set(id, data)
        ctx.body = { status: 0 }
      } catch (e) {
        ctx.body = { status: -1, msg: e.message || '保存失败' }
      }
    },
    async removePlugin(ctx) {
      const id = ctx.params.id
      //try {
      await sharelist.plugin.remove(id)
      ctx.body = {}
      //} catch (e) {
      ctx.body = {}
      //}
    },
    async upgradePlugin(ctx) {
      const id = ctx.params.id
      //try {
      await sharelist.plugin.upgrade(id)
      ctx.body = {}
      //} catch (e) {
      //  ctx.body = { status: -1, msg: e.message || '更新失败' }
      //}
    },
    async clearCache(ctx, next) {
      sharelist.cache.clear()
      ctx.body = { status: 0 }
    },

    async getPath(ctx, next) {
      // let { id } = ctx.request.body
      let runtime = await createRuntime(ctx)
      let { data, error } = await sharelist.getPathById(runtime)
      if (error) {
        ctx.body = { error }
        return

      }
      console.log('getPath', data)
      ctx.body = data
    },

    async get(ctx, next) {
      let runtime = await createRuntime(ctx)
      let data = await get(runtime)
      if (data.status) {
        ctx.status = data.status

        if (data.headers) {
          ctx.set(data.headers)
        }

        if (data.body) {
          ctx.body = data.body
        }
      } else if (data.redirect) {
        ctx.redirect(data.redirect)
      } else {
        ctx.body = data
      }
    },
    async list(ctx, next) {
      let runtime = await createRuntime(ctx)
      ctx.body = await list(runtime)
    },

    async transfer(ctx) {
      ctx.body = await sharelist.transfer.create('/aliyun/sync', '/onedrive/sync')
    },
    //upload request 有滞后性，需要接口手动停止
    async cancelUpload(ctx) {
      uploadManage.remove(ctx.params.id)
      ctx.body = {}
    },

    async remoteDownload(ctx) {
      let { url, dest } = ctx.request.body
      await sharelist.downloader.create(url, dest, true)
      ctx.body = {}
    },

    async removeRemoteDownload(ctx) {
      let id = ctx.params.id
      ctx.body = await sharelist.downloader.remove(id)
    },

    //查询/创建上传 ，即使后端服务重启后 查询依旧有效
    async createUpload(ctx) {
      console.log('here')
      let { size, hash, hash_type, id, name, upload_id, dest } = ctx.request.body
      let options = { size, name, uploadId: upload_id }

      if (hash_type && hash) {
        options[hash_type] = hash
      }
      options.manual = true

      stream = emptyStream()

      if (dest) {
        let dests = dest.split('/')
        let parent = await sharelist.driver.mkdir(id, dests, {}, true)
        if (parent?.id) id = parent.id
      }

      let res = await sharelist.driver.upload(id, stream, options)
      ctx.body = { uploadId: res.uploadId, start: res.start, completed: res.completed }

    },
    async upload(ctx) {
      let { size, hash, hash_type, id, name, upload_id } = ctx.query

      let stream = ctx.req

      let options = { size, name, uploadId: upload_id }
      if (hash_type && hash) {
        options[hash_type] = hash
      }

      let controller = new AbortController()
      options.signal = controller.signal

      if (upload_id) {
        uploadManage.add({ req: ctx.req, controller }, upload_id)
      }

      stream.pause()

      let res = await sharelist.driver.upload(id, stream, options)
      ctx.body = res

    },

    async pluginStore(ctx) {
      ctx.body = await sharelist.plugin.getFromStore()
    },

    async installPlugin(ctx) {
      let { url } = ctx.request.body
      try {
        await sharelist.plugin.createFromUrl(url)
        ctx.body = { status: 0 }
      } catch (e) {
        ctx.body = { error: { message: e.message || '安装失败' } }
      }
    },

    async tasks(ctx) {
      let transfer = await sharelist.transfer.all()
      let download = await sharelist.downloader.all()

      ctx.body = {
        transfer, download
      }
    },
    async task(ctx) {
      let id = ctx.params.id
      ctx.body = await sharelist.transfer.get(id)
    },
    async removeTask(ctx) {
      let id = ctx.params.id
      ctx.body = await sharelist.transfer.remove(id)
    },
    async resumeTask(ctx) {
      let id = ctx.params.id
      ctx.body = await sharelist.transfer.resume(id)
    },
    async pauseTask(ctx) {
      let id = ctx.params.id
      ctx.body = await sharelist.transfer.pause(id)
    },
    async retryTask(ctx) {
      let id = ctx.params.id
      ctx.body = await sharelist.transfer.retry(id)
    },
    async remove(ctx) {
      let { id } = ctx.request.body
      if (id) {
        await sharelist.driver.rm(id)
        ctx.body = { id }
      }
    },
    async mkdir(ctx) {
      let { id, name } = ctx.request.body
      if (id) {
        let data = await sharelist.driver.list({ id })
        if (data.files && data.files.includes(i => i.name == name)) {
          ctx.body = { error: { message: '此目录下已存在同名文件，请修改名称' } }
        } else {
          let res = await sharelist.driver.mkdir(id, name)
          if (res.id) {
            ctx.body = { id: res.id, name, type: 'folder' }
          }
        }
      }
    },
    async hashSave(ctx) {
      let { id, hash, name } = ctx.request.body
      let res = await sharelist.driver.hashFile(id, { hash, name })
      if (res) {
        res.name = name
        res.type = 'file'
      }
      ctx.body = res
    },

    async update(ctx) {
      let { id, name, dest, mode } = ctx.request.body
      if (name) {
        let res = await sharelist.driver.rename(id, name)
        ctx.body = { name: res.name }
      }

      // move / copy / transfer
      else if (dest) {

        let isSameDrive = await sharelist.driver.isSameDrive(id, dest)
        if (isSameDrive) {
          let res = await sharelist.driver.mv(id, dest, mode == 'copy')
          ctx.body = {}
        } else {
          await sharelist.transfer.create(id, dest, true)
          ctx.body = {}
        }
      }
    },

    async removeDisk(ctx) {
      let { disks } = ctx.request.body
    }
  }

}
