const fs = require('fs')
const yaml = require('yaml')
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const format = require('../utils/format')
const { getDrive, getAuth, getStream , getSource, updateLnk, checkAuthority, updateFile, updateFolder , getPreview , isPreviewable , command } = require('./plugin')

const diff = (a, b) => {
  let ret = []
  b.forEach((v, i) => {
    if (v != a[i]) {
      ret.push(v)
    }
  })
  return ret
}

const requireAuth = (data) => !!(data.children && data.children.find(i=>(i.name == '.passwd')))

class ShareList {
  constructor(root) {

  }

  async path(req) {
    if( req.body && req.body.act == 'auth' ){
      let ra = await this.auth(req)
      return { type:'auth_response' , result: ra }
    }
    //上传
    else if(req.upload){
      if(!req.upload.enable){
        return {
          type:'body',
          body:{ status:403 , result:'Forbidden'}
        }
      }
      let file = req.upload
      let ret = { file:file.name}
      let result = await command('upload' , {
        stream:file.stream ,
        path:file.options.filepath || [].concat(req.paths,file.options.path || file.options.name).join('/'),
        size:file.options.size
      })
      if(result.success){
        ret.status = 0
      }else{
        ret.status = 500
        let msg = typeof result.message == 'object' ? JSON.stringify(result.message) : result.message
        ret.result = msg
      }

      return {
        type:'body',
        body:ret
      }
    }
    else{
      let data = await command('ls' , req.paths.join('/') , function(data){
        if( requireAuth(data) && req.access.has(req.path) == false && !req.isAdmin) {
          return true
        }
      })
      
      //管理员模式无需密码
      if( requireAuth(data) && req.access.has(req.path) == false && !req.isAdmin) {
        data.type = 'auth'
      }
      return data
    }
    
  }

  async auth(req) {
    let data = await command('ls' , req.paths.join('/'))
    let hit = data.children.find(i => i.name == '.passwd')
    let content = await getSource(hit.id, hit.protocol , hit)
    let body = yaml.parse(content)
    let auth = getAuth(body.type)
    if (auth) {
      let ra = await auth(req.body.user, req.body.passwd, body.data)
      if(ra){
        req.access.add(req.path)
        return true
      }
    } 
    return false
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
}


module.exports = new ShareList()
