
/*
 * cp /a /b
 * cp /a/file.txt /b
 * cp /a/file.txt /b/fle2.txt
 */

const name = 'copy'

const version = '1.0'

const { PassThrough , Transform , Writeable, Readable } = require('stream')

const padRight = (str , len, charStr = ' ') => {
  let strlen = str.replace(/[^\x00-\xff]/g,"00").length
  return str + new Array(len - strlen + 1).join(charStr)
}

module.exports = ({ command , pathNormalize , createReadStream , createWriteStream , rectifier, byte }) => {  
  
  const tasks = {}

  var taskId = 0

  const parseWrite = async (task , path , extra = {}) => {
    let pl = path.replace(/^\//,'').split('/')
    let data , i = pl.length
    // destroy flag
    while(i>=0){
      if(task && task.destroy ) return null

      data = await command('ls' , '/'+pl.slice(0,i).join('/'))
      if(data){
        break
      }
      i--
    }
    console.log('prepare writestream for ', data.protocol+':'+data.id)
    if( data && data.id && data.protocol ){
      return await createWriteStream({...data , ...extra , target:pl.slice(i,pl.length).join('/')})
    }
  }

  const parseFiles = async (task, path, parent = '') => {
    if( task.destroy ) return []
    let data = await command('ls' , path)
    let files = []
    if(data && data.type == 'folder'){
      for(let i of data.children){
        if(i.type == 'folder'){
          files = files.concat( await parseFiles(task , path+'/'+i.name , parent+'/'+i.name) )
        }else{
          files.push( { path: `${parent}/`+i.name , id: i.id , name:i.name, size:i.size , protocol:i.protocol } )
        }
      }
    }else{
      files.push( { path: data.name , name:data.name, id: data.id , size:data.size,protocol:data.protocol , target_is_file:true} )
    }

    files.forEach(i => {
      i.stats = { status:'waiting' , speed:'0' , progress:'0%'} 
    })
    return files
  }


  // const BufferStream = class 

  const transfers = async (task) => {
    let { basepath , dst } = task.meta
    for(let i of task.list){
      // let readStream = await createReadStream(i)
      let readStream = await createReadStream(i)
      if( readStream ){
        //It's very important
        let size = i.size || readStream.size , name = i.name
        let writeStream = await parseWrite(task , pathNormalize( i.target_is_file ? dst : (dst + '/' + i.path), basepath) , {size , name})
        if( writeStream ){
          task.cWriteStream = writeStream
          task.cReadStream = readStream
          i.stats.status  = 'processing'
          let r = await process(rectifier(readStream) , writeStream , i)
          if(r === false){
             task.stats.error++
             i.stats.status  = 'error'
           }else{
             task.stats.success++
             i.stats.status  = 'success'
           }
        }else{
          task.stats.error++
          console.log( 'dst does not support write' )
          // return {result:'dst does not support write'}
        }
      }else{
        task.stats.error++
      }
      task.stats.cur++
    }

    task.status = 'finish'
  }

  const process = (readStream, writeStream , currentTask ) => {
    return new Promise((resolve , reject) => {
      let start , startCur , chunkSize = 0 , chunkSizeTotal = 0
      let trunkCache = []
      const onClose = err => {
        readStream.destroy();
        writeStream.destroy();
      };

      const onError = err => {
        console.log('err',err)
        resolve(false)
      };

      readStream.once('error', onError);
      writeStream.on('close', onClose);
      writeStream.once('error', onError);
      writeStream.on('finish' , ()=>{
        currentTask.stats.speed = byte( chunkSizeTotal * 1000 / (Date.now() - start))
        resolve(true)
      })

      readStream.on('write_data' , ({ current}) => {
        chunkSizeTotal += current
        if( !start ) {
          start = startCur = Date.now()
        }else{
          let time = Date.now()
          //chunkSize += current
          if( time - startCur > 3000 ){
            currentTask.stats.speed = byte(chunkSizeTotal * 1000 / (time - startCur))
            currentTask.stats.progress = Math.round(chunkSizeTotal * 100 / currentTask.size) + '%'
            //chunkSize = 0
            //startCur = time
          }
        }
      })
      readStream.pipe(writeStream);
    })
  }

  const removeTask = (id) => {
    if(id && tasks[id]){
      let task = tasks[id]
      if(task.status == 'init'){
        task.destroy = true
        return true
      }else if(task.status == 'processing'){
        //停止写入
        if(task.cWriteStream){
          task.cWriteStream.end()
          task.status = 'close'
          return true
        }else{
          return false
        }
      }else if( task.status == 'finish'){
        return true
      }

      delete tasks[id]
    }else{
      return false
    }
  }

  const queryTask = (id) => {
    if(id && tasks[id]){
      let task = tasks[id]
      let count = task.list.length
      let pathpadright = task.list.reduce((t,c)=>{
        let l = c.path.replace(/[^\x00-\xff]/g,"00").length
        return t > l ? t : l
      },0)
      let details = task.list.map((i,idx) => {
        return `${(idx+1)}/${count}\t${padRight(i.path,pathpadright+5)}${padRight(i.stats.status == 'processing' ? i.stats.progress : i.stats.status,20)}${padRight(i.stats.speed+'/S',15)}| ${byte(i.size)}`
      })
      return [
        `Task ${id} ${task.created_at.toISOString()}`,
        `total/success/error = ${task.stats.total}/${task.stats.success}/${task.stats.error}`,
        ``,
        details.join('\n'),
      ].join('\n')
    }
  }

  const cp = async (basepath , [src , dst]) => {
    if(src == '-h'){
      return {result:'cp -l : 列出所有任务\ncp -w id : 列出指定任务\ncp -k id : 移除指定taskId任务\ncp -r : 清除所有任务'}
    }

    if(src == '-l'){
      let keys = Object.keys(tasks)
      let p = Object.values(tasks).map((i,idx) => queryTask(keys[idx])).join('\n\n\n')
      return {result:p}
    }

    if(src == '-r'){
      for(let i in tasks){
        removeTask(i)
      }
    }

    if(src == '-k'){
      let res = removeTask(dst)
      if( res ) {
        return { result:`Task ${dst} closed successfully`}
      }else{
        return { message:'error' }
      }
    }

    if(src == '-w'){
      let res = queryTask(dst)
      if( res ) {
        let f = tasks[dst].status != 'finish'
        return { result: res , watch:f}
      }
    }

    let task = {
      created_at:new Date(),
      list: [],
      meta:{basepath , src , dst},
      stats:{total:'--' ,cur:0, success:0 , error:0, speed:0, error_files:[]},
      status:'init'
    }
    tasks[taskId++] = task

    //使用协议模式
    let vendorMode = /^[a-z0-7]+\:/.test(src)
    parseFiles(task , vendorMode ? src : pathNormalize(src , basepath)).then( files => {
      if(!task.destroy) {
        task.status = 'processing'
        task.list = files
        task.stats.total = files.length
        transfers(task)
      }
    })

    return { result:''}

  }

  //{ stream:'可读流' , path:'目标路径' , size:'文件大小'}
  const upload = ({ stream , path , size}) => {
    stream.pause()
    return new Promise((resolve,reject) => {
      parseWrite(null , path , {size}).then( writeStream => {
        if(!writeStream){
          resolve({ success:false , message:'未能初始化上传流'})
          return
        }
        if( writeStream && writeStream.error ){
          resolve({ success:false , message:writeStream.error })
          return 
        }
        stream.pipe( writeStream )
        stream.resume()

        writeStream.on('finish', () => {
          console.log('finish =============>')
          //clear cache
          resolve({ success:true })
        })

        writeStream.on('error', (e) => {
          console.log('upload error',e)
          resolve({ success:false , message:e.toString() })
        })
      })
    })
  }

  const wget = async (basepath='', [src]) => {
    return await cp(basepath , [src , src.split('/').pop()])
  }

  return { name , version , cmd:{ cp , upload , wget }}
}
