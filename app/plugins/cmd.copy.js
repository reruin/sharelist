
/*
 * cp /a /b
 * cp /a/file.txt /b
 * cp /a/file.txt /b/fle2.txt
 */

const name = 'copy'

const version = '1.0'

const { PassThrough , Transform , Writeable, Readable } = require('stream')

module.exports = ({ command , pathNormalize , createReadStream , createWriteStream , byte }) => {  
  
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
          files.push( { path: `${parent}/`+i.name , id: i.id , size:i.size , protocol:i.protocol } )
        }
      }
    }else{
      files.push( { path: data.name , id: data.id , size:data.size,protocol:data.protocol , target_is_file:true} )
    }
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
        let size = i.size || readStream.size 
        let writeStream = await parseWrite(task , pathNormalize( i.target_is_file ? dst : (dst + '/' + i.path), basepath) , {size})
        if( writeStream ){
          task.cWriteStream = writeStream
          task.cReadStream = readStream
          await process(readStream , writeStream , task)
        }else{
          task.stats.error++
          // return {result:'dst does not support write'}
        }
      }else{
        task.stats.error++
      }
    }

    task.status = 'finish'
  }

  const process = (readStream, writeStream, task) => {
    return new Promise((resolve , reject) => {
      let start , startCur , chunkSize = 0 , chunkSizeTotal = 0
      let trunkCache = []
      const onClose = err => {
        readStream.destroy();
        writeStream.destroy();
      };

      const onError = err => {
        console.log('err',err)
        //task.stats.error++
        //task.stats.error_files.push(task.dst)
        //resolve()
      };

      readStream.on('error', onError);
      writeStream.on('close', onClose);
      writeStream.on('error', onError);
      writeStream.on('finish' , ()=>{
        task.stats.success++
        task.stats.speed = byte( chunkSizeTotal * 1000 / (Date.now() - start))
        resolve()
      })

      let passThroughtStream = new PassThrough()
      passThroughtStream.on('data' , (chunk) => {
        chunkSizeTotal += chunk.length
        // console.log('read >>',chunk.length)
        if( !start ) {
          start = startCur = Date.now()
        }else{
          let time = Date.now()
          chunkSize += chunk.length
          if( time - startCur > 3000 ){
            task.stats.speed = byte(chunkSize * 1000 / (time - startCur))
            chunkSize = 0
            startCur = time
          }
        }

        // tasks.stats.chunkSizeTotal = chunkSizeTotal
      })
      readStream.pipe(passThroughtStream).pipe(writeStream);
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
      return [
        `Task: ${id}`,
        `created time: ${task.created_at}`,
        `${task.meta.basepath}: ${task.meta.src}  --> ${task.meta.dst}`,
        `status: ${task.status} ${ task.status == 'processing' ? (task.stats.speed+'/S') : '' } total/success/error = ${task.stats.total}/${task.stats.success}/${task.stats.error}`,
        `Error files:
          ${task.stats.error_files.join('\n')}`
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
      created_at:Date.now(),
      list: [],
      meta:{basepath , src , dst},
      stats:{total:'--' , success:0 , error:0, speed:0, error_files:[]},
      status:'init'
    }
    tasks[taskId++] = task

    //使用协议模式
    let vendorMode = /^[a-z0-7]+\:/.test(src)
    parseFiles(task , vendorMode ? src : pathNormalize(src , basepath)).then( read => {
      if(!task.destroy) {
        task.status = 'processing'
        task.list = read
        task.stats.total = read.length
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
          resolve(false)
          return
        }
        stream.resume()
        stream.pipe( writeStream )

        writeStream.on('finish', () => {
          console.log('finish')
          //clear cache
          resolve(true)
        })

        writeStream.on('error', () => {
          resolve(false)
        })
      })
    })
  }

  const wget = async (basepath='', [src]) => {
    return await cp(basepath , [src , src.split('/').pop()])
  }

  return { name , version , cmd:{ cp , upload , wget }}
}
