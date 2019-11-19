const yaml = require('yaml')
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const format = require('../utils/format')
const { getDrive, getAuth, getStream , getSource, updateLnk, checkAuthority, updateFile, updateFolder , getPreview , isPreviewable , command } = require('./plugin')

const access_check = (d) => {
  return d

  if (base.checkPasswd(d)) {
    return {
      auth: true,
      ...d
    }
  } else {
    return d
  }
}

const diff = (a, b) => {
  let ret = []
  b.forEach((v, i) => {
    if (v != a[i]) {
      ret.push(v)
    }
  })
  return ret
}

class ShareList {
  constructor(root) {

  }

  async path(paths, query , method) {
    return await command('ls' , paths.join('/') , [ query , method ] )
  }

  async auth(data, user, passwd) {
    let hit = data.children.find(i => i.name == '.passwd')
    let content = await getSource(hit.id, hit.protocol , hit)
    let body = yaml.parse(content)
    let auth = getAuth(body.type)
    if (auth) {
      return await auth(user, passwd, body.data)
    } else {
      return false
    }
  }

  /*
   * 获取文件预览页面
   */
  async preview(data){
    return await getPreview(data)
  }

  /*
   * 根据文件ID和协议获取可读流
   */
  async stream(ctx , id , type , protocol , data){
    return await getStream(ctx , id , type , protocol ,  data)
  }

  async source(id , protocol){
    return await getSource(id , protocol)
  }

  async exec(v , path){
    // TODO yargs
    let [cmd , ...options] = v.split(/\s+/)
    return await command(cmd , path , options , true) 
  }

  /*
   * 检测文件是否支持预览
   */
  async isPreviewable(data){
    return await isPreviewable(data)
  }

  mount() {
    let paths = config.getPath(), key

    // 如果只有一个目录 则直接列出
    if (paths.length == 1) {
      paths = paths[0].path
      return {
        id: paths.split(':').slice(1).join(':'),
        protocol: paths.split(':')[0],
        type: 'folder'
      }
    } else {
      //根路径不判断缓存，防止添加路径路径时丢失
      let disk = paths.map((i, index) => ({
        id: i.path.split(':').slice(1).join(':'),
        protocol: i.path.split(':')[0],
        name: i.name,
        size: '-',
        updated_at: '-',
        type: 'folder'
      }))

      return { id: '$root', protocol: 'root', type: 'folder', children: disk }
    }
  }
}


module.exports = new ShareList()
