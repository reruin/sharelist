/*
 * 91
 */

const name = '91'

const version = '1.0'

const protocols = ['91']

const defaultProvider = '91'

const host = Buffer.from('aHR0cDovL3d3dy45MXBvcm4uY29t', 'base64').toString('binary')

// 返回 { name , protocols, folder , file }

module.exports = (helper , cache , config , getSource) => {
  
  const request = helper.request

  const cats = [
    {id:'/default',cat:'default',name:'默认'},
    {id:'/rp',cat:'rp',name:'最近得分'},
    {id:'/rp',cat:'rf',name:'最近加精'},
    {id:'/hot',cat:'hot',name:'当前最热'},
    {id:'/top',cat:'top',name:'本月最热'},
    {id:'/tf',cat:'tf',name:'本月收藏'},
    {id:'/mf',cat:'mf',name:'收藏最多'},
  ]

  const getKeyByName = (name) => {
    const hit = cats.find( i => i.name == name)
    if(hit){
      return hit.id
    }else{
      return ''
    }
  }


  const getIdByPath = (path) => {
    let [cate , page , viewkey] = path.split('-')

    let id = getKeyByName(cate)
    if(id){
      if( page ){
        id += '/' + page
      }
      
      if(viewkey){
        id += '/' + viewkey
      }

      return id
    }else{
      return false
    }

  }

  const getPathById= (id) => {
    let [cate , page , viewkey] = id.substring(1).split('/')
    let hit = cats.find( i => `/${cate}` == i.id)
    page = parseInt(page)

    let ret = { cate , page , viewkey }

    if( hit ){
      ret.name = hit.name
    }

    return ret
  }

  const mount = () => {
    return {
      id : '/',
      type : 'folder',
      provider:defaultProvider,
      updated_at:Date.now(),
      children : cats.map(i=>{
        return {id:i.id , name:i.name , type:'folder',provider:defaultProvider}
      })
    }
  }

  //为中间状态生成数据
  const mountForCate = (name) => {
    // [ type-page , viewkey ] OR [ viewkey ]
    name = decodeURIComponent(helper.decode(name))

    let childId = getIdByPath( name )
    if( childId ){
      let p = {
        id : '/',
        type : 'folder',
        provider:defaultProvider,
        updated_at:Date.now(),
        children : [{id : childId, name , type:'folder',provider:defaultProvider}]
      }
      return p
    }else{
      return false
    }
   
  }

  const mountForItem = (name , id) => {
    name = decodeURIComponent(helper.decode(name))

    let p = {
      id : '0',
      type : 'folder',
      provider:defaultProvider,
      updated_at:Date.now(),
      children : [{id : `/f/${id}`, name , type:'video', provider:defaultProvider}]
    }
    return p
  }

  const getDetail = async (viewkey) => {

    let { body } = await request.get(`${host}/view_video.php?viewkey=${viewkey}`, {fake:true})

    let url = (body.match(/source\s*src\s*=\s*"([^"]+)/) || ['',''])[1]
    let name =(body.match(/viewvideo-title">([^<]+)/) || ['',''])[1].replace(/[\r\n]/g,'').replace(/(^[\s]*|[\s]*$)/g,'')
    
    return {
      id:'/f/'+viewkey,
      name:name+'.mp4',
      type:'video',
      ext:'mp4',
      provider:defaultProvider,
      url:url
    }
  }

  const getList = async (id) => {
    let { cate , page , name } = getPathById(id)

    let { body } = await request.get(`${host}/v.php?page=${page}&category=${cate}`)
    let children = []

    body.replace(/viewkey=([0-9a-z]+)[^<]+?\s*<img\s+src="([^"]+?)"[\w\W]+?title="([^"]+?)"/g , ($0 , $1, $2, $3)=>{
      children.push({
        id : `/f/${$1}`, 
        name : $3,
        provider:defaultProvider,
        updated_at:'-',
        size:'-',
        type:'video',
        ext:'mp4'
      })
      return ''
    })

    children.push({
      id : `/${cate}/${page+1}`,
      name : '-->',
      url:`../${name}-${page+1}`,
      provider:defaultProvider,
      type:'folder'
    })

    if(page>1){
      children.push({
        id : `/${cate}/${page-1}`,
        name : '<--',
        url:`../${name}-${page-1}`,
        provider:defaultProvider,
        type:'folder'
      })
    }

    return {
      id : '/'+cate+'/'+page,
      type : 'folder',
      provider:defaultProvider,
      updated_at:Date.now(),
      children
    }
  }


  //path: /cate/page
  const folder = async(id , data) => {

    const paths = data.paths

    const lv = id == '/' ? 0 : id.substring(1).split('/').length

    // console.log('paths',paths , id)
    //为各自的父级模拟数据
    if( paths.length > 0 ){
      // /cate
      if( lv == 0){
        return mountForCate( paths[0])
      }
      // /cate/page/viewkey
      else if( lv == 3){
        return mountForItem( paths[0] , id.split('/').pop() )
      }

    }
    else{
       // /
      if( lv == 0){
        return mount()
      }

      // /cate
      else if( lv == 1){
        return await getList( id + '/1' )
      }
      // /cate/page
      else if( lv == 2){
        return await getList( id )
      }
      
      else{
        return []
      }
    }
  }

  /**
   * /f/viewkey
   */
  const file = async(id) =>{
    let viewkey = id.split('/f/')[1]
    if(viewkey){
      let resp = await getDetail( viewkey )
      console.log( resp )
      return resp
    }else{
      return false
    }
  }

  return { name , version, protocols, folder , file }
}