const fs = require('fs')
const mime = require('mime')
const http = require('./http')
const { Writable } = require('stream');

const getRange = (r , total)=>{
  let [, start, end] = r.match(/(\d*)-(\d*)/);
  start = start ? parseInt(start) : 0
  end = end ? parseInt(end) : total - 1

  return [start , end]
}

const mergeHeaders = (a , b) => {
  const exclude = ['host','accept-encoding']
  let pre = {...a , ...b}
  let headers = {}
  for(let key in pre){
    if(exclude.includes(key) == false){
      headers[key] = pre[key]
    }
  }
  return headers
}

const sendFile = async(ctx , path , {maxage , immutable} = {maxage:0 , immutable:false})=>{
  let stats
  try {
    stats = fs.statSync(path)
  } catch (err) {
    const notfound = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR']
    if (notfound.includes(err.code)) {
      throw createError(404, err)
    }
    err.status = 500
    throw err
  }

  let fileSize = stats.size
  let filename = path.split(/[\/\\]/).pop()


  if (!ctx.response.get('Last-Modified')) ctx.set('Last-Modified', stats.mtime.toUTCString())
  if (!ctx.response.get('Cache-Control')) {
    const directives = ['max-age=' + (maxage / 1000 | 0)]
    if (immutable) {
      directives.push('immutable')
    }
    ctx.set('Cache-Control', directives.join(','))
  }
  

  ctx.set('Content-type',mime.getType(filename))
  
  //partial support
  ctx.set('Accept-Ranges', 'bytes')

  let chunksize = fileSize
  let readOpts = {bufferSize:64*1024}
  let range = ctx.get('range')

  if (range){
    let [start , end] = getRange(ctx.header.range , fileSize)
    ctx.set('Content-Range', 'bytes ' + `${start}-${end}/${fileSize}`)
    ctx.status = 206

    readOpts.start = start
    readOpts.end = end
    chunksize = end - start + 1
    
  }else{
    ctx.set('Content-Range', 'bytes ' + `0-${fileSize-1}/${fileSize}`)
  }
  ctx.length = chunksize

  ctx.set('Content-Disposition',`attachment;filename=${encodeURIComponent(filename)}`)
  ctx.body = fs.createReadStream(path , readOpts)
}

const getFileSize = async (url , headers) => {
  let nh = await http.header(url , {headers})
  if(nh && nh['content-length']){
    return nh['content-length']
  }else{
    return null
  }
}
const sendHTTPFile = async (ctx , url  ,data = {}) => {
  let headers = data.headers || {}

  headers = mergeHeaders(ctx.req.headers , headers)
  let fileSize = null;
  if(data && data.size){
    fileSize = data.size;
  }
  
  if(fileSize){
    let range = ctx.get('range')
    let fileSize = data.size
    let chunksize = fileSize
    if(range){
      let [start , end] = getRange(ctx.header.range , fileSize)
      ctx.set('Content-Range', 'bytes ' + `${start}-${end}/${fileSize}`)
      ctx.status = 206

      chunksize = end - start + 1
    }else{
      ctx.set('Content-Range', 'bytes ' + `0-${fileSize-1}/${fileSize}`)
      ctx.status = 206
    }
    ctx.length = chunksize
  }

  let extra = data.proxy_options || {}
  if(data.proxy_headers){
    for(let i in data.proxy_headers){
      headers[i] = data.proxy_headers[i]
    }
  }

  let stream = http({url , headers , ...extra})
  stream.on('response', function(response) {
    ctx.status = response.statusCode
    if(response.headers){
      for(let i in response.headers)
      ctx.set(i , response.headers[i])
    }
    //console.log(response.headers['content-type']) // 'image/png'
  })
  ctx.body = stream //.pipe(ctx.res)
}

const getFile = async (url) => {
  if(fs.existsSync( url )){
    return fs.readFileSync(url, 'utf8')
  }
}

const getHTTPFile = async (url ,headers = {}) => {
  let { body } = await http.get(url , { headers } )
  return body
}

const sendStream = async (ctx , id , adapter , data = {}) => {
  let fileSize = null , start , range = {};

  headers = mergeHeaders(ctx.req.headers , data.headers || {})

  let havaSize = false
  if(data && data.size){
    fileSize = data.size;
    havaSize = true
  }

  if(fileSize){
    if(ctx.get('range')){
      let [ start , end ] = getRange(ctx.get('range') , fileSize)
      range = {start , end , chunksize : end - start + 1}
    }else{
      range = {start:0 , end:fileSize-1 , chunksize:fileSize}
    }
  }

  let opts = { ...data , id , reqHeaders:headers , range , ctx:ctx}
  const stream = await adapter(opts)

  if(havaSize){
    // if(acceptRanges){
    //   ctx.status = 206
    //   ctx.set('Accept-Ranges', 'bytes')
    //   ctx.set('Content-Range', 'bytes ' + `${range.start}-${range.end}/${range.chunksize}`)
    //   ctx.length = range.chunksize
    // }else{
      ctx.set('Accept-Ranges', 'none')
      ctx.length = fileSize
    // }
  }else{
    ctx.set('Accept-Ranges', 'none')
  }
  
  if(stream) ctx.body = stream
}

module.exports = { sendFile , sendHTTPFile , sendStream , getHTTPFile , getFile }