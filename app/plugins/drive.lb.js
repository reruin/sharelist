// 负载均衡器

const name = 'LoadBalancer'

const version = '1.0'

const protocols = ['lb']

const defaultProtocol = 'lb'

const rnd = (l) => {
  let roll = Math.round( Math.random() * (l.length - 1) )
  return l[roll].replace(/^\//,'')
}

module.exports = ({getConfig, setIgnorePaths , pathNormalize , getDrives , getRuntime}) => {

  const getCurrentPath = async (name) => {
    let paths = await getDrives()

    setIgnorePaths( 'lb' , paths.reduce((t,c) => t.concat( c.path.split(':')[1].split(';') ),[]) )

    if(name){
      let hit = paths.find( i => i.name == name)
      if( hit ){
        return rnd(hit.path.split(':')[1].split(';'))
      }
    }
  }

  getCurrentPath()

  const folder = async(id) => {

    let path = getRuntime('req').path

    let rootName = path.replace(/^\//,'').split('/')[0]

    let hit = await getCurrentPath(decodeURIComponent(rootName))

    if( hit ){

      path = path.replace(/^\/[^\/]+/,`/${(hit)}`)
      return {
        type:'redir',
        name:rootName,
        path:path
      }
    }else{
      return false
    }
  }

  const file = async(id)=>{
    console.log(id)
    let realdir = realpath(normalize(id))
    let stat = {}
    try{
      stat = fs.statSync(realpath(realdir))
    }catch(e){}

    return {
      id,
      name: path.basename(id),
      ext: extname(id),
      url: realpath(id),
      size:stat.size,
      protocol:defaultProtocol,
      outputType:'file',
      proxy:true
    }
  }

  return { name , version , drive:{ protocols , folder , file , cache:false} }
}