const yaml = require('yaml')
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const format = require('../utils/format')
const { getDrive, getAuth, getStream , getSource, updateLnk, checkAuthority, updateFile, updateFolder , getPreview , isPreviewable } = require('./plugin')

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

    //{gd , od , xd , ld , remote}
  }

  async path(paths, query, full_paths , method) {
    let pl = paths.join('/'),
      hit, resp = false,
      miss

    //1. path -> target , 需要处理缓存时长
    const content = cache.get(pl, true)
    if (content) {
      console.log(`Get Cahce For Path(${pl})`)
      return updateFolder(content)
    }

    if (pl == '') {
      hit = this.mount()
    } else {
      let parent = await this.path(paths.slice(0, -1), query, full_paths , method)
      let curname = decodeURIComponent(paths[paths.length - 1])
      //父目录必然是 folder
      if (parent) {
        // if( parent.auth ) {
        //   hit = {auth:true , ...parent}
        // }else{
        let children = parent.children || []
        let index = base.search(children, 'name', curname)
        if (index != -1) {
          hit = children[index]
          //只为目录做缓存
          if (hit.type == 'folder' && hit.id){
            cache.set(pl, hit.protocol + ':' + hit.id)
          }
        } else {
          return false
        }
        // }

      }
      //无法完成匹配
      else {
        return false
      }
    }

    //2. 根据对象属性 做下一步操作
    if (hit.protocol == 'root') {
      return hit
    }

    let vendor = getDrive(hit.protocol)
    if (vendor) {

      //处理快捷方式

      if (hit.lnk) {
        let originId = hit.protocol + ':' + hit.id
        await updateLnk(hit)
        //更新 driver
        vendor = getDrive(hit.protocol)

        //缓存 快捷方式 的实际链接
        cache.set(originId, hit.protocol + ':' + hit.id)
      }

      // folder /a/b/c
      if (hit.type == 'folder') {

        resp = await vendor.folder(hit.id, { query, req : config.getRuntime('req') ,paths: diff(paths, full_paths), content: hit.content })
        if (resp) updateFolder(resp)
        //let passwd = base.checkPasswd(resp)
        //resp.auth = passwd !== false

        //存在 id 变化 ，例如 OneDrive 的shareid <-> resid, ln 的链接
        //重新缓存 path -> resid
        if (hit.id != resp.id) {
          cache.set(pl, hit.protocol + ':' + resp.id)
        }

      }
      // file  /a/b/c.jpg
      else {
        resp = await vendor.file(hit.id, hit)
        // console.log( resp )
        // 最终输出时更新文件操作
        await updateFile(resp)
      }
    }

    // console.log('path return ' , resp)
    return resp
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
