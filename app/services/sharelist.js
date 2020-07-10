const fs = require('fs')
const yaml = require('yaml')
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const format = require('../utils/format')
const { getDrive, getAuth, getStream , getSource, updateLnk, checkAuthority, updateFile, updateFolder , getPreview , isPreviewable , command } = require('./plugin')
// const wrapReqStream = require('../utils/wrapReqStream')


class ShareList {
  constructor(root) {
    this.passwdPaths = new Set()
  }

 /**
   * Path diff
   *
   * @param  {string} [a] path_a
   * @param  {string} [b] path_b
   * @return {boolean} 
   * @api private
   */
  async diff(a,b){
    let ret = []
    b.forEach((v, i) => {
      if (v != a[i]) {
        ret.push(v)
      }
    })
    return ret
  }

  /**
   * Check folder contain passwd file
   *
   * @param  {object} [data]
   * @return {boolean} 
   * @api private
   */
  hasPasswdFile(data){
    return !!(data.children && data.children.find(i=>(i.name == '.passwd')))
  }

  /**
   * Search the first serect path
   *
   * @param  {object} [req]
   * @return {mixed} 
   * @api private
   */
  searchPasswdPath(req){
    for(let i = 1 ; i <= req.paths.length ; i++){
      let path = '/'+req.paths.slice(0,i).join('/')
      if( this.passwdPaths.has(path) && req.access.has(path) == false && !req.isAdmin){
        return path
      }
    }
    
    return null
  }

  /**
   * Find the folder(file) data by path
   *
   * @param  {object} [req]
   * @return {object} 
   * @api public
   */
  async path(req) {
    if( req.body && req.body.act == 'auth' ){
      let ra = await this.auth(req)
      return { type:'auth_response' , result: ra }
    }
    // upload request
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
      let passwdPath = this.searchPasswdPath(req)
      let targetPath = '/'+req.paths.join('/') , currentPath = ''
      let qs = req.querystring ? ('?' + req.querystring) : ''
      let targetFullPath = encodeURIComponent(targetPath+qs)

      if(!passwdPath || passwdPath == targetPath || targetPath == '/'){
        let currentPath
        let data = await command('ls' , targetPath, (data , paths) => {
          currentPath = '/' + paths.join('/')
          if( data.auth || (this.hasPasswdFile(data) && req.access.has(currentPath) == false && !req.isAdmin)) {
            this.passwdPaths.add(currentPath)
            // console.log(currentPath,true,req.access,encodeURIComponent(currentPath))
            return true
          }
        })
        if(data.type == 'folder'){
          if(currentPath && targetPath != currentPath){
            return { type:'redirect', 'redirect':currentPath+'?rurl='+targetFullPath}
          }else{
            if( this.hasPasswdFile(data) && req.access.has(decodeURIComponent(req.path)) == false && !req.isAdmin) {
              this.passwdPaths.add(targetPath)
              data.type = 'auth'
            }else{
              if(this.passwdPaths.has(targetPath)){
                this.passwdPaths.delete(targetPath)
              }
            }
            return data
          }
        }else{
          return data
        }
        
      }else{
        return { type:'redirect', 'redirect':passwdPath+'?rurl='+targetFullPath }
      }
      
    }
    
  }
  /**
   * Verify auth by path
   *
   * @param  {object} [req]
   * @return {boolean} 
   * @api private
   */
  async auth(req) {
    let data = await command('ls' , req.paths.join('/'))
    // //自定义验证
    // if(data.auth){
    //   let authHelper = getAuth(data.protocol)
    //   if(authHelper){
    //     let ra = await authHelper(data.id, req.body)
    //     if(ra){
    //       req.access.add(decodeURIComponent(req.path))
    //       return true
    //     }
    //   }
    // }else{
      let hit = data.children.find(i => i.name == '.passwd')
      let content = await getSource(hit.id, hit.protocol , hit)
      let body = yaml.parse(content)
      let auth = getAuth(body.type)
      if (auth) {
        let ra = await auth(req.body.user, req.body.passwd, body.data)
        if(ra){
          req.access.add(decodeURIComponent(req.path))
          return true
        }
      } 
    // }
    
    return false
  }

  /**
   * Get previewable data
   * 
   * @param {object}
   * @return {object} 
   * @api public
   */
  async preview(data){
    return await getPreview(data)
  }

  /**
   * Get readable stream by file id
   *
   * @param {object} [ctx]  * required
   * @param {string} [id]   * required file id
   * @param {type}   [type] * required stream type
   * @return {stream}
   * @api public
   */
  async stream(ctx , id , type , protocol , data){
    return await getStream(ctx , id , type , protocol ,  data)
  }

  /**
   * Get file content by file id
   *
   * @param  {string} [id]       * required file id
   * @param  {type}   [protocol] * required stream type
   * @param  {object} [data]     file data
   * @return {stream}
   * @api public
   */
  async source(id , protocol , data){
    return await getSource(id , protocol , data)
  }

  /**
   * Execute core command
   * 
   * @param {string} [v] command and args
   * @param {string} [path] command execution path
   * @return {mixed}
   * @api public
   */
  async exec(v , path){
    // TODO yargs
    let [cmd , ...options] = v.split(/\s+/)
    return await command(cmd , path , options , true) 
  }

  /**
   * Check the file support preview
   * 
   * @param  {object} [data] file data
   * @return {boolean}
   * @api public
   */
  async isPreviewable(data){
    return await isPreviewable(data)
  }
}


module.exports = new ShareList()