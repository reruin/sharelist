
const name = 'copy'

const version = '1.0'

module.exports = ({ command , pathNormalize , createReadStream , createWriteStream }) => {  
  
  const tasks = []

  const parseWrite = async (path) => {
    let pl = path.replace(/^\//,'').split('/')
    let data , i = pl.length
  
    while(i>=0){
      data = await command('ls' , '/'+pl.slice(0,i).join('/'))
      if(data){
        break
      }
      i--
    }
    if( data && data.id && data.protocol ){
      if( data.type == 'folder'){

      }else{
        return await createWriteStream({...data , nextPath:pl.slice(i,pl.length).join('/')})
      }
    }
  }

  const parseRead = async (path) => {
    let data = await command('ls' , path)
    if( data && data.id && data.protocol ){
      return await createReadStream(data)
    }
  }

  const parseFiles = async (path) => {
    let data = await command('ls' , path)
    let files = []
    if(data && data.type == 'folder'){
      for(let i of data.children){
        if(i.type == 'folder'){
          files.concat( await parseFiles(path+'/'+i.name) )
        }else{
          files.push( i )
        }
      }
    }else{
      files.push( data )
    }
    return files
  }


  const pipe = async (src , dst , callback) => {
    let readStream = await parseRead(pathNormalize(src , basepath))
    if( readStream ){
      let writeStream = await parseWrite(pathNormalize(dst , basepath))
      if( writeStream ){
        readStream.pipe(writeStream)
        readStream.on('end' , callback)
      }else{
        return {result:'dst does not support write'}
      }
    }else{
      return {result:'src does not support read'}
    }

    return { result : 'Task added successfully, enter `task list` to get detail' }
  }

  const cp_dir = () => {

  }

  const cp = async (basepath , [src , dst]) => {

    parseFiles(pathNormalize(src , basepath)).then( read => {
      for(let i of read){
        
      }
    })

    let read = await command('ls' , )

    //目录拷贝
    if( read.type == 'folder' ){

    }
    //文件拷贝
    else{
      let readStream = await parseRead(pathNormalize(src , basepath))
      if( readStream ){
        let writeStream = await parseWrite(pathNormalize(dst , basepath))
        if( writeStream ){
          readStream.pipe(writeStream)
        }else{
          return {result:'dst does not support write'}
        }
      }else{
        return {result:'src does not support read'}
      }

      return { result : 'Task added successfully, enter `task list` to get detail' }
    }

  }


  return { name , version , cmd:{ cp }}
}
