const fs = require('fs')
const path = require('path')
const querystring = require('querystring')
const resources = {}
const {MIMEType , isArray , isObject , params , decode } = require('../utils/base')
const format = require('../utils/format')
const cache = require('../utils/cache')
const http = require('../utils/http')
const config = require('../config')

const assign = (...rest) => Object.assign(...rest)

const parse = (data) => {
  return data
}

const driverMap = {}

const helper = {
  isArray : isArray,
  isObject: isObject,
  byte:format.byte,
  datetime:format.datetime,
  request:http, 
  querystring:querystring,
  decode:decode
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
      const filepath = path.join(p, name);

      const pluginName = name.split('.')[0]
      let resource = {};

      if (name.endsWith('.js') ) {
        resource = require(filepath)(helper , cache , config , getSource)
        if(resource.name){
          resources[pluginName] = {}
          assign(resources[pluginName], resource)

          if( resource.protocols ){
            resource.protocols.forEach( protocol => {
              driverMap[protocol] = pluginName
            })
          }
        }
      }
    }
  }

  console.log('Load Drive: ',driverMap)
}


const getDriver = (ext) => {
  let name = driverMap[ext]
  return resources[name]
}

const getSource = async (id , ext) => {
  if(driverMap[ext]){
    let provider = getDriver(ext)
    let d =  await provider.file(id)
    if(d.protocol === 'file'){
      if(fs.existsSync( d.url )){
        return fs.readFileSync(d.url, 'utf8')
      }
    }else{
      let data = await http.get(data.url)
      return data.body
    }
  }

  return false
}

const updateFile = (v) => {
  if(v.type != 'folder'){
    v.type = MIMEType(v.ext)
  }
}

const isInlineLnk = (name) => {
  return /\.[^\.]+?\.[^\.]+?$/.test(name)
}

const updateFolder = (folder) => {
  let parentType = folder.provider
  folder.children.forEach( d => {
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

        //虚拟磁盘 name.type
        let isVD = len>2 && ext == 'd'

        if(isVD){
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
      if( len > 1 && driverMap[type] ){
        d.name = tmp.slice(0,-1).join('.')
        d.type = 'folder'
        d.lnk = true
        d.size = null
        if( getDriver(type).virtual === true ){
          d.virtual = true
        }
      }
    }

    updateFile(d)

  })
  
  folder.children.sort((a,b)=>{
    return a.type == 'folder' && b.type != 'folder' ? -1 : a.type != 'folder' && b.type == 'folder' ? 1 : a.name > b.name
  })
}

const getDriverTypeFromId = (id) => {

}

/*
 * 处理快捷方式
 */
const updateLnk = async (d) => {
  //获取快捷方式的指向内容
  const content = await getSource(d.id , d.provider)
  //分析内容实体
  const meta = parseLnk(content)
  //从id中猜测协议

  //包含协议时
  if(meta){
    d.provider = meta.protocol
    d.id = meta.id
  }
  //不包含协议
  else{
    //从 id 猜测协议
    let protocol = d.id.split('.').pop()

    console.log('try protocol',protocol)
    if(driverMap[protocol]){
      d.provider = protocol
      d.content = content
    }
  }
}

const parseLnk = (content) => {
  content = content.replace(/^\s+/,'').replace(/\s+$/,'')
  let tmp = content.split(':')
  let protocol = tmp[0]
  //匹配到
  if( driverMap[protocol] ){
    return { protocol , id:tmp.slice(1).join(':')}
  }else{
    return false
  }
}
//
load({dirs:[__dirname + '/drive']})

module.exports = { load , getDriver , getSource , updateFolder , updateFile , updateLnk }