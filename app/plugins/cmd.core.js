/*
 * 核心命令
 */

const name = 'core'

const version = '1.0'

const search = (ret, key, value) => {
  for (let i in ret) {
    if (ret[i][key] == value) {
      return i
    }
  }
  return -1
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


module.exports = ({ cache , getVendor , getConfig , getRuntime , updateFolder , updateLnk , updateFile , pathNormalize , createReadStream , createWriteStream }) => {  
  const ls = async (p , [query, full_paths = [], method] = [] , iscmd) => {
    let resp = await process(p , {query , full_paths , method})
    if( iscmd ){
      if( resp.children ){
        resp = { result: resp.children.map(i => i.name).join('\n') }
      }else{
        resp = 'path not ready'
      }
    }

    return resp
  }

  const cd = async (basepath , [path = '/'] = []) => {
    return {cd:pathNormalize(path , basepath)}
  }

 
  const cls = async () => {
    return {cls:1}
  }

  const root = () => {
    let paths = getConfig('path'), key

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


  const process = async(p, { query, full_paths = [], method }) => {
    let hit, resp = false,
      miss
    let paths = p.replace(/^\//,'').split('/')
    let pl = paths.join('/')
    //1. path -> target , 需要处理缓存时长
    const content = cache.get(pl, true)
    if (content) {
      console.log(`path${pl}) -> fileid -> cahce`)
      return updateFolder(content)
    }

    if (pl == '') {
      hit = root()
    } else {
      let parent = await process(paths.slice(0, -1).join('/'), { query, full_paths , method })
      let curname = decodeURIComponent(paths[paths.length - 1])
      //父目录必然是 folder
      if (parent) {
        // if( parent.auth ) {
        //   hit = {auth:true , ...parent}
        // }else{
        let children = parent.children || []
        let index = search(children, 'name', curname)
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

    let vendor = getVendor(hit.protocol)

    if (vendor) {

      //处理快捷方式
      if (hit.lnk) {
        let originId = hit.protocol + ':' + hit.id
        await updateLnk(hit)

        vendor = getVendor(hit.protocol)

        //缓存 快捷方式 的实际链接
        cache.set(originId, hit.protocol + ':' + hit.id)
      }

      //folder 
      if (hit.type == 'folder') {

        resp = await vendor.folder(hit.id, { query, req : getRuntime('req') ,paths: diff(paths, full_paths), content: hit.content })
        if (resp) updateFolder(resp)

        //TODO check passwd

        if (hit.id != resp.id) {
          cache.set(pl, hit.protocol + ':' + resp.id)
        }

      }
      // file
      else {
        resp = await vendor.file(hit.id, { query, req : getRuntime('req') ,paths: diff(paths, full_paths), data: hit })
        await updateFile(resp)
      }
    }

    return resp
  }


  return { name , version , cmd:{ ls , cd , cls }}
}