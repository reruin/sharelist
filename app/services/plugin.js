const fs = require('fs')
const path = require('path')
const querystring = require('querystring')
const {getFileType , getMIME , isArray , isObject , params , base64 , getRandomIP , retrieveSize , extname , pathNormalize, parseStream , xml2json } = require('../utils/base')
const format = require('../utils/format')
const cache = require('../utils/cache')
const http = require('../utils/http')
const config = require('../config')
const { sendFile , sendHTTPFile ,sendStream, getFile, getHTTPFile } = require('../utils/sendfile')
const wrapReadableStream = require('../utils/wrapReadableStream')
const rectifier = require ('../utils/rectifier')
const chunkStream = require('../utils/chunkStream')

const assign = (...rest) => Object.assign(...rest)

const driveMap = new Map()

const driveMountableMap = new Map()

const formatMap = new Map()

const authMap = new Map()

const previewMap = new Map()

const cmdMap = new Map()

const readstreamMap = new Map()

const writestreamMap = new Map()

const resources = {}

const whenReadyHandlers = []

const whenReady = (handler) => {
  if(ready) {
    return Promise.resolve(handler())
  }else{
    return new Promise((resolve,reject) => {
      whenReadyHandlers.push( () => {
        resolve(handler())
      })
    })
  }
}



const isClass = fn => typeof fn == 'function' && /^\s*class/.test(fn.toString());

var ready = false

var resourcesCount = 0

const recognize = async (image , type, lang) => {
  let server = config.getConfig('ocr_server')
  let preProcess = (data) => {

    let serverData = server.split('#')
    let output = 'result'
    let ct = 'form'
    let options = {
      url:serverData[0],
      method:'POST',
    }
    let reform = {}
    if(serverData[1]){
      let form = querystring.parse(serverData[1] || '') || {}
      if(form.$noscheme){
        data.image = data.image.split(',')[1]
        delete form.$scheme
      }
      if( form.$method ) {
        options.method == form.$method
        delete form.$method
      }
      if( form.$ct ){
        ct = form.$ct
        delete form.$ct
      }
      if( form.$output ){
        output = form.$output
        delete form.$output
      }

      for(let i in form){
        let value = form[i]
        if(data[value]){
          reform[i] = data[value]
        }else{
          reform[i] = value
        }
      }
    }else{
      reform = data
    }

    options[ct] = reform
    
    if(output){
      if( output != 'raw'){
        options.json = true
      }
    }

    return { options , output }
  }

  const getValue = (value , output) => {
    if(!value) return value
    let ret = value
    if(output != 'raw'){
      try{
        let fn = new Function(`return this.${output};`);
        ret = fn.call(value) || ''
      }catch(e){
        ret = ''
      }
    }
    return ret
  }

  if(server){
    let resp
    let { options , output } = preProcess({image , type, lang })
    // console.log(options,output)
    try{
      resp = await http({...options , async:true})
    }catch(e){
      console.log(e)
    }
    // console.log(options,resp.body)
    if(resp && resp.body){
      return { error:false , result:getValue(resp.body , output)}
    }else{
      return { error:false , result:''}
    }
  }

  return { error:true , msg:'ocr server is NOT ready!'}
}

/*
 * 根据文件id获取详情
 */
const getSource = async (id , driverName , data) => {
  if(driveMap.has(driverName)){
    let vendor = getDrive(driverName)
    let d = await vendor.file(id , { req: config.getRuntime() , data } )
    if(d.outputType === 'file'){
      return await getFile(d.url)
    }
    else if(d.outputType === 'stream'){
      if(vendor.createReadStream){
        return await parseStream( await vendor.createReadStream({id}) )
      }
    }
    else{
      return await getHTTPFile(d.url , d.headers || {})
    }
  }
  return false
}

//和getSource类似 file | stream | url
/*
 * 根据文件id获取详情
 */
const getStream = async (ctx , id ,type, protocol , data) => {
  if(type === 'file'){
    return await sendFile(ctx , id)
  }
  else if(type === 'stream'){
    let vendor = getDrive(protocol)
    if(vendor && vendor.createReadStream){
      return await sendStream(ctx , id , (...rest) => vendor.createReadStream(...rest) , data);
    }
  }
  else{
    return await sendHTTPFile(ctx , id , data)
  }
  return false
}

/*
 * 获取文件可预览数据 
 * @params data { name , ext , url }
 */
const getPreview = async (data) => {
  let ext = data.ext
  let name = previewMap.get(ext)
  return name ? await resources[name].preview[ext](data , config.getRuntime()) : null
}

const isPreviewable = async (data) => {
  return previewMap.has(data.ext)
}

const sandboxCache = (id) => {
  return {
    get(key , ...rest){
      return cache.get(`@${id}_${key}` , ...rest)
    },
    set(key , ...rest){
      cache.set(`@${id}_${key}` , ...rest)
    },
    clear(key , ...rest){
      cache.clear(`@${id}_${key}`,...rest)
    }
  }
}

const getHelpers = (id) => {
  return  {
    isArray : isArray,
    isObject: isObject,
    datetime:format.datetime,
    request:http, 
    querystring:querystring,
    base64:base64,
    cache:sandboxCache(id),
    getSource: getSource,
    getConfig : config.getConfig,
    setIgnorePaths : config.setIgnorePaths,
    getRandomIP:getRandomIP,
    retrieveSize : format.retrieveByte,
    byte:format.byte,
    getDrive : config.getDrive,
    getRuntime:config.getRuntime,
    extname:extname,
    updateFolder,
    updateFile,
    updateLnk,
    getVendor:getDrive,
    createReadStream,
    createWriteStream,
    pathNormalize,
    command,
    wrapReadableStream,
    rectifier,
    chunkStream,
    recognize,
    xml2json,
    getOption:()=>{

    },
    getPluginOption:(key)=>{
      let p = id + '___' + key
      return config.getPluginOption(p)
    },
    setPluginOption:(key , value)=>{
      let p = id + '___' + key
      config.setPluginOption(p , value)
    },
    saveDrive : (path , name) => {
      let resource = resources[id]
      let protocols = []
      if( resource && resource.drive && resource.drive.protocols){
        protocols = resource.drive.protocols
      }else if( resource.protocol ){
        protocols = [ resource.protocol ]
      }
      
      let protocol = path.split(':')[0]
      if(protocols.includes(protocol)){
        config.saveDrive(path , name)
      }
    },

    getDrives : () => {
      return  whenReady( () => {
        let resource = resources[id]
        let protocols = []
        if( resource && resource.drive && resource.drive.protocols){
          protocols = resource.drive.protocols
        }else if( resource.protocol ){
          protocols = [ resource.protocol ]
        }

        return config.getDrives(protocols)
      })
    }
  }
}

/**
 * 加载插件
 */
var loadOptions = []
const load = (options) => {
  loadOptions = options
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
        const id = 'plugin_' + pluginName.replace(/\./g,'_')
        const helpers = getHelpers(id)
        let ins = require(filepath)
        console.log('Load Plugins: ',pluginName)

        let resource
        if( isClass(ins) ){
          let driver = new ins(helpers)
          let { protocol , mountable , createReadStream , createWriteStream } = driver
          driver.helper = helpers
          resources[id] = {
            label:driver.label,
            mountable,protocol,
            drive:driver,
            name:driver.name
          }
          driveMap.set(protocol , id)

          if(mountable) driveMountableMap.set(protocol , id)
          if(createReadStream) readstreamMap.set(protocol , driver.createReadStream)
        }else{
          resource = ins.call(helpers,helpers)

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

            if( resource.drive.createReadStream ){
              protocols.forEach( protocol => {
                readstreamMap.set(protocol , resource.drive.createReadStream)
              })
            }

            if( resource.drive.createWriteStream ){
              protocols.forEach( protocol => {
                writestreamMap.set(protocol , resource.drive.createWriteStream)
              })
            }
          }
          
          if(resource.format){
            for(let key in resource.format){
              formatMap.set(key , id)
            }
          }

          if(resource.preview){
            for(let key in resource.preview){
              previewMap.set(key , id)
            }
          }

          if(resource.cmd){
            for(let key in resource.cmd){
              cmdMap.set(key , id)
            }
          }
        }
        
      }
    }
  }

  for(let i = whenReadyHandlers.length ; i-- ; ){
     whenReadyHandlers[i].call()
     whenReadyHandlers.splice(i,1)
  }
  ready = true
}

const reload = () => {
  load(loadOptions)
}
/**
 * 根据协议获取可处理的驱动
 */
const getDrive = (protocol) => {
  if( driveMap.has(protocol)){
    let id = driveMap.get(protocol)
    return resources[id].drive
  }
}

/**
 * 根据扩展名获取格式化工具
 */
const getFormater = (ext) => {
  let name = formatMap.get(ext)
  return name ? resources[name].format[ext] : null
}

/**
 * 更新文件详情数据
 */
const updateFile = async (file) => {
  if(file.type != 'folder'){
    file.type = getFileType(file.ext)
  }
  file.displaySize = format.byte(file.size)

  
  let formater = getFormater(file.ext)
  if( formater ){
    await formater(file)
  }
  return file
}

/**
 * 更新文件目录数据
 */
const updateFolder = (folder) => {
  let parentType = folder.protocol
  if(!folder.children) return folder
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
      d.type = getFileType(d.ext)
      if(!d.mime) d.mime = getMIME(d.ext) || 'file/unknow'
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
    label: resources[id].label || resources[id].name,
    protocol : resources[id].protocol || resources[id].drive.protocols[0]
  }
})

const getAuth = (type) => {
  if( authMap.has(type) ){
    return resources[ authMap.get(type) ].auth[type]
  }else{
    let drive = getDrive(type)
    if(drive && drive.auth){
      return drive.auth
    }else{
      return false
    }
  }
}
//

const checkAuthority = async (d , user, passwd) => {
  const content = await getSource(d.id , d.protocol)

}

const command = async (cmd , ...rest) => {
  if(cmdMap.has(cmd)){
    return resources[ cmdMap.get(cmd) ].cmd[cmd](...rest)
  }else{
    return {result:'unknow command'}
  }
}

const createReadStream = async (options) => {
  //默认使用 file 获取
  let { id , protocol } = options
  if( readstreamMap.has(protocol) ){
    return await readstreamMap.get(protocol)(options)
  }
}

const createWriteStream = async (options) => {
  let { id , protocol } = options
          
  let drive = getDrive(protocol)
  if(drive.createWriteStream){
    return await drive.createWriteStream(options)
  }else if( writestreamMap.has(protocol) ){
    return await writestreamMap.get(protocol)(options)
  }
}

module.exports = { load , reload , getDrive , getStream , getSource , updateFolder , updateFile , updateLnk , getVendors , getAuth , getPreview , isPreviewable , command}