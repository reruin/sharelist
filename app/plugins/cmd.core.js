/*
 * 核心命令
 */

const name = 'core'

const version = '1.0'

const diff = (a, b) => {
  let ret = []
  b.forEach((v, i) => {
    if (v != a[i]) {
      ret.push(v)
    }
  })
  return ret
}

var nodeCache = {}

const clone = (obj) => {
  let type = typeof obj
  if( type == 'number' || type == 'string' || type == 'boolean' || type === undefined || type === null ){
    return obj
  }

  if (obj instanceof Array) {
    return obj.map(i => clone(i))
  }

  if (obj instanceof Object) {
    let copy = {};
    for (let attr in obj) {
      if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr])
    }
    return copy
  }

  return obj
}

module.exports = ({ cache , getVendor , getConfig , getRuntime , updateFolder , updateLnk , updateFile , pathNormalize , createReadStream , createWriteStream }) => {  
  const ls = async (p , filter , iscmd) => {
    //处理 协议路径 protocol:id
    let vp = p.split(':')
    if(vp.length){
      let protocol = vp[0] , id = vp.slice(1).join(':')
      let vendor = getVendor(protocol)
      if( vendor ){
        return await vendor.file(id)
      }
    }

    // 处理标准路径 path
    let resp = await process_fast(p , filter)

    if( iscmd ){
      if( resp.children ){
        resp = { result: resp.children.map(i => i.name).join('\n') }
      }else{
        resp = 'path not ready'
      }
    }

    let ret = clone(resp)
    if(ret.children){
      ret.children.forEach(i => {
        if(i.ext) i.ext = i.ext.toLowerCase()
      })
    }else if(ret.ext){
      ret.ext = ret.ext.toLowerCase()
    }
    return ret
  }

  const cat = async (p) => {

  }

  const cd = async (basepath , [path = '/'] = []) => {
    return {cd:pathNormalize(path , basepath)}
  }

 
  const cls = async () => {
    return {cls:1}
  }

  const root = () => {
    let paths = getConfig('path'), key

    let disk = paths.map((i, index) => ({
      id: i.path.split(':').slice(1).join(':'),
      protocol: i.path.split(':')[0],
      name: i.name,
      size: 0,
      updated_at: '',
      type: 'folder'
    }))

    return { id: '$root', protocol: 'root', cache:false , type: 'folder', children: disk }
  }


  /*
   * 1.缓存挂载节点 <-> sharelist路径
   * 2.缓存passwd节点 <-> sharelist路径
   * 3.正向查找
   * 4.不再缓存 sharelist路径 <-> 数据 关系
   */
  const process_fast = async(p, filter) => {

    //  paths : / => [''] ;  /a/b/c => [a','b','c']

    let hit = root()
    let paths = (p == '' || p == '/') ? [] : p.replace(/^\//,'').split('/').map(i => decodeURIComponent(i))
    let idx = 0
    let isRoot = paths.length == 0

    //逆向查询节点 path -> filemeta { protocol , id , type } -> filedata
    while( idx >= 0 ){
      let cur = '/' + paths.slice(0,idx).join('/')
      let content = nodeCache[cur]
      if( content ){
        hit = content
        //过滤器拦截      
        if(filter && filter(hit , paths.slice(0,idx+1))){
          return hit;
        }
        idx--
        break
      }else{
        idx--
      }
    }
    

    if(hit.protocol == 'root'){
      if( hit.children && hit.children.length == 1 ){
        hit = hit.children[0]
      }else if( isRoot ){
        return hit
      }
    }

    for( ; idx < paths.length; idx++ ){

      if(paths[idx] && hit.children){
        let children = hit.children
        hit = children.find(i => i.name == paths[idx])
        if( !hit ){
          return false
        }
      }

      if(hit.protocol == 'root' ){
        if(filter && filter(hit , [])){
          return hit;
        }
        continue
      }
      
      let vendor = getVendor(hit.protocol)

      if (hit.lnk) {
        let originId = hit.protocol + ':' + hit.id
        await updateLnk(hit)

        vendor = getVendor(hit.protocol)
        //缓存 快捷方式 的实际链接
        cache.set(originId, hit.protocol + ':' + hit.id)
      }

      //root 下不做缓存
      if( vendor.cache !== false && hit.type == 'folder' && idx > 0 ){
        let cacheId = '/' + paths.slice(0,idx + 1).join('/')
        nodeCache[cacheId] = { protocol: hit.protocol , id : hit.id , type: hit.type }
      }
      
      if( hit.type == 'folder'){
        let t = await vendor.folder(hit.id , { req : getRuntime('req')})
        //console.log(t.type,t.children)
        if( t ){
          if( t.type == 'folder' ){
            hit = await updateFolder(t)
            if( vendor.createWriteStream ){
              hit.writeable = true
            }
          }
          else if(t.type == 'redir') {
            hit = await process_fast(t.path)
            //不再参与后续
            break;
          }
          else{
            hit = await updateFile(t)
          }
        }else{
          return false
        }
      }
      else{
        let t = await vendor.file(hit.id, { data:hit , req : getRuntime('req') })
        if( t ){
           hit = await updateFile(t)
           break
        }else{
          return false
        }
      }

      //过滤器拦截      
      if(filter && filter(hit , paths.slice(0,idx+1))){
        return hit;
      }

    }
    
    return hit
  }


  return { name , version , cmd:{ ls , cd , cls }}
}