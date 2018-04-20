function rnd(min , max){
  return Math.floor(min+Math.random()*(max-min));  

}
module.exports = {
  extend(source , src){
    for(var i in src){
      source[i] = src[i]
    }
    return source
  },
  hash(d , key){
    let ret = {}
    d.forEach((i)=>{
      ret[i[key]] = i
    })
    return ret
  },

  isEmail(v){
  	return /^[A-Za-zd]+([-_.][A-Za-zd]+)*@([A-Za-zd]+[-.])+[A-Za-zd]{2,5}$/.test(v)
  },

  ip(){
    return rnd(50,250) + "." + rnd(50,250) + "." + rnd(50,250)+ "." + rnd(50,250);  
    
  },

  base64_encode(v){
    return new Buffer(v).toString('base64').replace(/\//g,'_')
  },

  base64_decode(v){
    return new Buffer(v.replace(/_/g,'/'), 'base64').toString()
  },

  params (url){
    url = url.split('?')[1]
    let reg = /(?:&)?([^=]+)=([^&]*)/ig,
    obj = {},
    m

    while(m = reg.exec(url)) obj[m[1]] = m[2]

    return obj
  }
}