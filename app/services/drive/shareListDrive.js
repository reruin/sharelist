/*
 * xdrive 是 sharelist 内置的使用yaml描述的网盘系统 , 没有缓存
 * xd: rootId(yaml文件所在路径) + yaml文件名 + ':' + 排序
 */

const name = 'ShareListDrive'

const version = '1.0'

const protocols = ['xd','sld']

const defaultProvider = 'xd'

const yaml = require('yaml').default


module.exports = (helper , cache , config , getSource) => {

  /* 递归生成 索引 id */
  const createId = (d , rootId)=>{
    d.forEach((i , index)=>{
      if(helper.isObject(i)){
        i.id = rootId + '/'+ i.name.replace(/\.d\.ln$/,'').replace(/\.ln$/,'')
        i.provider = defaultProvider
        if(i.children) {
          i.type = 'folder'
          i.provider = defaultProvider
          createId(i.children , i.id)
        }else{
          i.ext = i.name.split('.').pop()
        }

      }else if(helper.isArray(i)){
        createId(i , rootId)
      }
    })
    return d
  }

  const mount = async(rootId , data)=>{
    let resid = `${defaultProvider}:${rootId}`
    let resp = { id : rootId , type:'folder' , provider:defaultProvider }

    // if(cache(resid)) {
    //   resp = cache(resid)
    //   if(
    //     resp.updated_at && 
    //     ( Date.now() - resp.updated_at < config.data.cache_refresh_dir)

    //   ){
    //     console.log('mount xd from cache')
    //     return resp
    //   }
    // }

    if(data){
      let json = yaml.parse( data )

      json  = createId(json , rootId + ':')
      resp.children = json
      resp.updated_at = Date.now()

      cache(resid,resp)
      return resp
    }else{
      return undefined
    }
  }

  const findById = (id)=>{
    let rootId = id.split(':').slice(0,-1).join(':')
    let disk = cache(`${defaultProvider}:${rootId}`)
    let path = id.split(':/')[1].split('/')

    console.log( rootId , disk , path)
    for(let i=0; i<path.length && disk; i++){
      disk = disk.children
      disk = disk.find(j => {
        return `${j.name}` == path[i]

        if( j.type == 'folder' ){
          return `${j.name}.${j.ext}` == path[i]
        }else{
          return `${j.name}` == path[i]
        }
      }) //[ parseInt(path[i]) ]
    }

    return disk
  }

  const folder = async(id , data) => {
    if( data.content ){
      return mount(id , data.content)
    }else{
      return findById(id)
    }
  }

  const file = async(id)=>{
    let data = findById(id)
    return data
  }

  return { name , version, protocols, folder , file , virtual : true}
}