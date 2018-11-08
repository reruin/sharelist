const fs = require('fs')
const path = require('path')
const querystring = require('querystring')
const {MIMEType , isArray , isObject , params , base64 , getRandomIP } = require('../utils/base')
const format = require('../utils/format')
const cache = require('../utils/cache')
const http = require('../utils/http')
const config = require('../config')
const { getHTTPFile } = require('../utils/sendfile')

const assign = (...rest) => Object.assign(...rest)

let driveMap = new Map()

let driveMountableMap = new Map()

let formatMap = new Map()

let authMap = new Map()

let resources = {}

let resourcesCount = 0

const getSource = async (id , driverName) => {
  if(driveMap.has(driverName)){
    let vendor = getDrive(driverName)
    let d = await vendor.file(id)
    if(d.outputType === 'file'){
      if(fs.existsSync( d.url )){
        return fs.readFileSync(d.url, 'utf8')
      }
    }else{
      return await getHTTPFile(d.url , d.headers || {})
    }
  }
  return false
}

const helper = {
  isArray : isArray,
  isObject: isObject,
  datetime:format.datetime,
  request:http, 
  querystring:querystring,
  base64:base64,
  cache:cache,
  getSource: getSource,
  getConfig : config.getConfig,
  getRandomIP:getRandomIP,
}

const load = (options) => {

  const dir = options.dir
  const dirs = options.dirs

  if (dir && dirs.indexOf(dir) === -1) {
    dirs.push(dir)
  }
  
  for (let i = 0; i < dirs.length; i++) {
    const p = dirs[i]
    if (!fs.existsSync(p)) {
      continue
    }

    const names = fs.readdirSync(p)

    for (let j = 0; j < names.length; j++) {
      const name = names[j];

      let resource;

      if (name.endsWith('.js') ) {
        const filepath = path.join(p, name);

        const pluginName = name.split('.').slice(0,-1).join('.')
        const type = name.split('.')[0]

        const resource = require(filepath)(helper)

        console.log('Load Plugins: ',pluginName)

        const id = 'plugin_' + resourcesCount++

        resources[id] = resource

        if( resource.auth ){
          for(let key in resource.auth){
            authMap.set(key , id)
          }
        }

        if( resource.drive ){
          let protocols = [].concat(resource.drive.protocols || [])
          let mountable = resource.drive.mountable !== false
          protocols.forEach( protocol => {
            driveMap.set(protocol,id)
            if(mountable) driveMountableMap.set(protocol , id)
          })
        }
        
        if(resource.format){
          for(let key in resource.format){
            formatMap.set(key , id)
          }
        }
      }
    }
  }

}


const getDrive = (ext) => {
  let id = driveMap.get(ext)
  return resources[id].drive
}

const getFormater = (ext) => {
  let name = formatMap.get(ext)
  return name ? resources[name].format[ext] : null
}

//更新文件详情数据
const updateFile = async (file) => {
  if(file.type != 'folder'){
    file.type = MIMEType(file.ext)
  }

  file.displaySize = format.byte(file.size)

  
  let formater = getFormater(file.ext)
  if( formater ){
    await formater(file)
  }
  return file
}

// 用于更新目录数据
const updateFolder = (folder) => {
  let parentType = folder.protocol
  folder.children.forEach( (d , index) => {
    let name = d.name

    // let type = (name.match(/(?<=\.)([^\.]+)$/) || [0])[0]
    let tmp = name.split('.')
    let type = tmp[tmp.length-1]
    let len = tmp.length

    // 快捷链接类型

    // 文件快捷方式 name.ext.ln
    // 文件夹快捷方式 或 虚拟磁盘 name.d.ln

    // 虚拟磁盘 name.type
    if( len > 1 ){
      if( type == 'ln' ){
        let ext  = tmp[tmp.length-2]

        //目录快捷方式 name.d.ln
        let isDir = len > 2 && ext == 'd'

        if(isDir){
          d.name = tmp.slice(0,-2).join('.')
          d.type = 'folder'
        }else{
          d.name = tmp.slice(0,-1).join('.')
          //可能后缀
          d.ext = ext
        }

        d.lnk = true
        d.size = null
      }

      //虚拟磁盘
      else if( driveMap.has(type) ){
        d.name = tmp.slice(0,-1).join('.')
        d.type = 'folder'
        d.lnk = true
        d.size = null
      }
    }

    if(d.type != 'folder'){
      d.type = MIMEType(d.ext)
    }

    d.displaySize = format.byte(d.size)
    d.$ = index

    if(d.name === '.passwd'){
      d.hidden = true
    }
  })
  
  folder.children.sort((a,b)=>{
    return a.type == 'folder' && b.type != 'folder' ? -1 : a.type != 'folder' && b.type == 'folder' ? 1 : (a.$ - b.$)
  })

  return folder
} 


/*
 * 调用解析器处理
 */
const updateLnk = async (d) => {
  //获取快捷方式的指向内容
  const content = await getSource(d.id , d.protocol)
  //分析内容实体
  const meta = parseLnk(content)
  //从id中猜测协议

  //包含协议时
  if(meta){
    d.protocol = meta.protocol
    d.id = meta.id
  }
  //不包含协议
  else{
    //从 id 猜测协议
    let protocol = d.id.split('.').pop()

    if(driveMap.has(protocol)){
      d.protocol = protocol
      d.content = content
    }
  }
}

const parseLnk = (content) => {
  content = content.replace(/^\s+/,'').replace(/\s+$/,'')
  let tmp = content.split(':')
  let protocol = tmp[0]
  //匹配到
  if( driveMap.has(protocol) ){
    return { protocol , id:tmp.slice(1).join(':')}
  }else{
    return false
  }
}

const getVendors = () => [...new Set(driveMountableMap.values())].map(id => {
  return {
    name : resources[id].name,
    protocol : resources[id].drive.protocols[0]
  }
})

const getAuth = (type) => {
  if( authMap.has(type) ){
    return resources[ authMap.get(type) ].auth[type]
  }else{
    return false
  }
}
//

const checkAuthority = async (d , user, passwd) => {
  const content = await getSource(d.id , d.protocol)

}

module.exports = { load , getDrive , getSource , updateFolder , updateFile , updateLnk , getVendors , getAuth}