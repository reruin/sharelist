const { nanoid } = require('nanoid')

const crypto = require('crypto')

const fs = require('fs')

const path = require('path')

const compareSemver = require('semver-compare-lite')

const md5 = content => crypto.createHash('md5').update(content).digest("hex")

const { request } = require('@sharelist/core')
const { config } = require('process')

const plugins_mirror = {
  'github': 'https://raw.githubusercontent.com/linkdrive/plugins/master',
  'unpkg': 'https://unpkg.com/@linkdrive/plugins',
  'eleme': 'https://npm.elemecdn.com/@linkdrive/plugins'
}

const parseMeta = (filepath, isPath = true, dir) => {
  const content = isPath ? fs.readFileSync(filepath, 'utf-8') : filepath
  const metaContent = content.match(/(?<===Sharelist==)[\w\W]+(?===\/Sharelist==)/)?.[0]
  const meta = {
    hash: md5(content)
  }

  if (metaContent) {
    let pairs = metaContent.split(/[\r\n]/).filter(Boolean).map(i => i.match(/(?<=@)([^\s]+?)\s+(.*)/)).filter(Boolean)
    for (let i of pairs) {
      meta[i[1]] = i[2]
    }
  }

  if (isPath) {
    if (!meta.name) meta.name = path.basename(filepath).replace(/\.js$/i, '')
    // if(meta.name)
    meta.id = md5(meta.name || path)
    meta.path = filepath
  } else {
    let name = nanoid()
    meta.id = md5(meta.name || name)
    if (dir) meta.path = path.join(dir, name + '.js')
  }

  return meta

}

const clearNodeCache = (id) => {

  delete require.cache[id]

  Object.keys(module.constructor._pathCache).forEach(function (cacheKey) {
    if (cacheKey.indexOf(id) > -1) {
      delete module.constructor._pathCache[cacheKey];
    }
  });

}

class Plugin {
  constructor(options) {
    this.options = options
    this.plugins = {}
    this.inited = false
  }

  /**
   * extract plugin meta
   */
  scanMeta() {
    let { options, plugins } = this
    let dirs = [options.pluginDir].filter(Boolean)
    let newLoad = []
    for (let dir of dirs) {
      try {
        let files = fs.readdirSync(dir)
        for (let i of files) {
          let filepath = path.join(dir, i)
          let file = fs.statSync(filepath)
          if (file.isFile() && /\.js$/i.test(i)) {
            let meta = parseMeta(filepath)
            //plugin content has changed

            //test
            // meta.hash = Math.random() + ''
            if (plugins[meta.id]?.hash != meta.hash) {
              newLoad.push(meta)
              plugins[meta.id] = meta
            }
          }
        }
      } catch (e) {
        console.log(e)
      }
    }

    this.inited = true

    return newLoad
  }

  load() {
    console.log('load plugins')
    const plugins = this.scanMeta()
    const ret = []
    for (let i of plugins) {
      let item = { name: i.name, hash: i.hash }
      try {
        clearNodeCache(require.resolve(i.path))
        item.module = require(i.path)
        // item.code = fs.readFileSync(i.path)
        ret.push(item)
      } catch (e) {
        console.log(e)
      }
    }

    return ret
  }

  get(id) {
    if (!this.inited) {
      this.scanMeta()
    }

    if (id) {
      return this.plugins[id]
    } else {
      return Object.values(this.plugins)
    }
  }

  set(id, data) {
    let meta = this.plugins[id], filepath
    let { pluginDir } = this.options
    if (!meta) {
      const newMeta = parseMeta(data, false, pluginDir)
      if (!newMeta.name) {
        throw new Error('invalid script / 脚本无效 - 缺少名称')
      }
      meta = newMeta
      filepath = newMeta.path
    } else {
      filepath = meta.path
    }
    fs.writeFileSync(filepath, data)
    this.options?.onUpdate(meta)
  }

  async createFromUrl(url) {
    console.log('Download plugin:', url)
    let res = await request(url, {
      responseType: 'text'
    })
    this.set(null, res.data)
  }

  async getFromStore() {
    const plugins = this.get()
    console.log('SOURCE: ' + plugins_mirror[this.options.pluginSource()])
    let { data } = await request(plugins_mirror[this.options.pluginSource()] + '/list.json?t=' + Date.now(), {
      // responseType: 'text'
      // headers: {
      //   'cache-control': 'no-cache',
      //   'pragma': 'no-cache'
      // }
    })
    // data = JSON.parse(data)
    // console.log(data)

    data.forEach(i => {
      if (i.updateURL.indexOf('raw.githubusercontent.com') >= 0) {
        if (i.namespace) {
          if (plugins.find(j => j.namespace == i.namespace)) {
            i.installed = true
          }
        }
        i.updateURL = this.replaceSource(i.updateURL)//.replace('/master', '@master')

        if (i.namespace?.startsWith('http') && !i.supportURL) {
          i.supportURL = i.namespace
        }
      }
    })
    return data
  }

  remove(id) {
    let meta = this.plugins[id]
    if (meta.path) {
      fs.unlinkSync(meta.path)
      delete this.plugins[id]
      this.options?.onRemove(meta.hash)
    } else {
      throw new Error('invalid script / 脚本无效')
    }
  }

  replaceSource(url) {
    console.log(url, plugins_mirror.github)
    return url.replace(plugins_mirror.github, plugins_mirror[this.options.pluginSource()])
  }

  async upgrade(id) {
    let meta = this.plugins[id]
    if (meta?.id && meta.updateURL) {
      console.log('Upgrade Plugin:', meta.updateURL, this.replaceSource(meta.updateURL))
      let { data } = await request(this.replaceSource(meta.updateURL), { responseType: 'text' })
      if (!data) {
        throw new Error('没有获取到有效内容 / Invalid content')
      }

      let newmeta = parseMeta(data, false)
      if (meta.version && compareSemver(newmeta.version, meta.version) == 1) {
        console.log('[UPDATE PLUGIN]' + meta.name + ` ${meta.version} --> ${newmeta.version}`)
        this.set(meta.id, data)
      } else {
        throw new Error('已是最新版本')
      }
    } else {
      throw new Error('无法完成更新: 插件不存在 或 未设置更新地址.Unable to complete update: the plugin does not set the update url')
    }
  }

  getSources() {
    return Object.keys(plugins_mirror)
  }
}

exports.createPlugin = (options) => {
  return new Plugin(options)
}

exports.pluginConfigKey = ['globalSearch', 'localSearch', 'uploadHash', 'hash', 'isRoot']
