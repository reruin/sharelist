// 负载均衡器

const name = 'LoadBalancer'

const version = '1.0'

const protocols = ['lb']

const defaultProtocol = 'lb'

const rnd = (l) => {
  let roll = Math.round( Math.random() * (l.length - 1) )
  return l[roll].replace(/^\//,'')
}

module.exports = ({getConfig, setIgnorePaths , getDrives , getRuntime}) => {

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

  const folder = async() => {

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

  return { name , label:'负载均衡', version , drive:{ protocols , folder , file : folder, cache:false} }
}