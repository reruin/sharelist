module.exports = async (ctx , next)=>{
  let url = ctx.request.path.substring(1)
  if(url){
    ctx.paths = url.split('/')
  }else{
    ctx.paths = []
  }
  await next()
}