module.exports = async (ctx , next)=>{
  let url = ctx.request.path.substring(1)
  if(url){
    let raw = url.split('/')
    let paths = []
    for(let i = 0 ; i< raw.length ; i++){
      if( i == 0 || /[^!]$/.test(raw[i-1]) ){
        paths.push(raw[i].replace(/!$/,''))
      }
    }
    // let paths = raw.filter((i)=>(!/^!/.test(i)))
    ctx.paths = paths
    ctx.paths_raw = raw
  }else{
    ctx.paths = []
    ctx.paths_raw = []
  }
  await next()
}