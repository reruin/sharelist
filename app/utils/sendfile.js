const fs = require('fs')
const mime = require('mime')
const http = require('./http')

const getRange = (r , total)=>{
  let [, start, end] = r.match(/(\d*)-(\d*)/);
  start = start ? parseInt(start) : 0
  end = end ? parseInt(end) : total - 1

  return [start , end]
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

  ctx.response.set('Content-Disposition',`attachment;filename=${encodeURIComponent(filename)}`)
  ctx.body = fs.createReadStream(path , readOpts)
}

const sendHTTPFile = async (ctx , url , headers) => {
  ctx.body = ctx.req.pipe(http({url , headers})).pipe(ctx.res)
}

const getHTTPFile = async (url ,headers = {}) => {
  let { body } = await http.get(url , { headers } )
  return body
}

module.exports = { sendFile , sendHTTPFile , getHTTPFile }