module.exports = async (ctx , next)=>{
  let addr = ctx.req.headers['x-forwarded-for'] ||
        ctx.req.connection.remoteAddress ||
        ctx.req.socket.remoteAddress ||
        ctx.req.connection.socket.remoteAddress
  let res = addr.split(':')
  let ipv4 = 'N/A', ipv6 = 'N/A'

  if(res.length > 1){
    ipv4 = res[res.length - 1]
    ipv6 = res.splice(-1,1).join(':')
  }else{
    ipv4 = addr
  }
  ctx.addr = { ipv4, ipv6}
  await next()
}