const fs = require('fs')

const getRange = (r)=>{
  let start = 0
  if( typeof r != 'undefined') {
    start = (r.match(/^(?<=bytes=)[0-9]+$/) || [-1])[0]
    start = Number(start)
  }
  return start
}

const send = async(ctx , path , {maxage , immutable} = {maxage:0 , immutable:false})=>{
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
  let readOpts = {bufferSize:1024*1024}
  // stream
  ctx.set('Content-Length', fileSize)
  if (!ctx.response.get('Last-Modified')) ctx.set('Last-Modified', stats.mtime.toUTCString())
  if (!ctx.response.get('Cache-Control')) {
    const directives = ['max-age=' + (maxage / 1000 | 0)]
    if (immutable) {
      directives.push('immutable')
    }
    ctx.set('Cache-Control', directives.join(','))
  }

  if (!ctx.response.get('Range')){
    let pos = getRange(ctx.response.get('Range'))
    if(pos >= 0){
      ctx.set('Accept-Range', 'bytes')
      ctx.set('Content-Range', 'bytes ' + pos + '-' + (fileSize - 1) + '/' + fileSize)

      readOpts.start = pos
      readOpts.end = fileSize
    }
  }

  let filename = path.split(/[\/\\]/).pop()
  ctx.response.set('Content-Disposition',`attachment;filename=${filename}`)
  ctx.body = fs.createReadStream(path , readOpts)

  return path
}

module.exports = send