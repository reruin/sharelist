/*
 * 91
 */

const name = '91'

const version = '1.0'

const protocols = ['91']

const defaultProtocol = '91'

const host = Buffer.from('aHR0cDovL3d3dy45MXBvcm4uY29t', 'base64').toString('binary')

const base64decode = v => Buffer.from(v, 'base64').toString('binary')

const base64encode = v => Buffer.from(v).toString('base64')

// 返回 { name , protocols, folder , file }

module.exports = (helper , cache , config , getSource) => {
  
  const request = helper.request

  const cats = [
    {id:'/default/1',cat:'default',name:'默认'},
    {id:'/rp/1',cat:'rp',name:'最近得分'},
    {id:'/rf/1',cat:'rf',name:'最近加精'},
    {id:'/hot/1',cat:'hot',name:'当前最热'},
    {id:'/top/1',cat:'top',name:'本月最热'},
    {id:'/tf/1',cat:'tf',name:'本月收藏'},
    {id:'/mf/1',cat:'mf',name:'收藏最多'},
  ]
  //cate_page_viewkey

  const mount = () => {
    return {
      id : '/',
      type : 'folder',
      protocol:defaultProtocol,
      updated_at:Date.now(),
      children : cats.map(i=>{
        return {id:i.id , name:i.name , type:'folder',protocol:defaultProtocol}
      })
    }
  }

  const getNameByCate = (cate) => {
    let hit = cats.find( i => i.cat == cate)
    if( hit ){
      return hit.name
    }else{
      return '默认'
    }
  }

  const getCateByName = (cateName) => {
    let hit = cats.find( i => i.name == cateName)
    if( hit ){
      return hit.cat
    }else{
      return 'default'
    }
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
      mime:'video/mp4',
      protocol:defaultProtocol,
      url:url
    }
  }

  const getCate = (value) => {
    let [cateName , page] = value.split('-')
    if(!page) page = 1
    let cate = getCateByName(cateName)
    console.log( 'get cdate' , { id: cate + '/' + page ,  name:value})
    return getMock( { id: cate + '/' + page ,  name:value})
  }

  const getMock = (opts) => {
    let child = {id:'' , name: '',  type:'folder', protocol:defaultProtocol } 
    for( let  i in opts ){
      child[i] = opts[i]
    }

    return {
      id : '-1',
      type : 'folder',
      protocol:defaultProtocol,
      updated_at:Date.now(),
      children : [ child ]
    }
  }

  const getList = async (id) => {
    let [,cate,page] = id.split('/')
    if(!page) page = 1
    page = parseInt(page)
    let { body } = await request.get(`${host}/v.php?page=${page}&category=${cate}`)
    let children = []

    body.replace(/viewkey=([0-9a-z]+)[^<]+?\s*<img\s+src="([^"]+?)"[\w\W]+?title="([^"]+?)"/g , ($0 , $1, $2, $3)=>{
      children.push({
        id : `/${cate}/${page}/${$1}`, 
        name : $3+'.mp4',
        url: `./${$1}/${$3}.mp4`,
        protocol:defaultProtocol,
        updated_at:'-',
        size:'-',
        type:'video',
        ext:'mp4'
      })
      return ''
    })

    let cateName = getNameByCate(cate)

    children.push({
      id : `/${cate}/${page+1}`,
      name : `第${page+1}页`,
      url:`../${cateName}-${page+1}`,
      protocol:defaultProtocol,
      type:'folder'
    })

    if(page>1){
      children.push({
        id : `/${cate}/${page-1}`,
        name : `第${page-1}页`,
        url:`../${cateName}-${page-1}`,
        protocol:defaultProtocol,
        type:'folder'
      })
    }
    return {
      id : '/'+cate+'/'+page,
      type : 'folder',
      protocol:defaultProtocol,
      updated_at:Date.now(),
      children
    }
  }


  /**
   * id:
   * case 0: /
   * case 1: /cate
   * case 2: /cate/page
   * case 3  /cate/page/viewkey
   *
   * path
   * case a /cate
   * case b /cate-page
   * case c /cate/viewkey
   * case d /cate/viewkey/videoname.mp4
   */
  const folder = async(id , {paths}) => {

    //后续路径

    ///const data = decode(id)

    const lv = id == '/' ? 0 : id.substring(1).split('/').length

    const direct = paths.length == 0

    const len = paths.length

    const value = paths[0]
    //let [cate , page , key] = 
    //console.log(id , lv , paths)
    // console.log('paths',paths , id)

    console.log('***' , lv,id , paths)

    // case 0
    if( lv == 0 ){
      if( len == 0 ){
        return mount() 
      }
      // case b , c , d => mock
      else {
        return getCate(decodeURIComponent(helper.decode(value)))
      }
    }

    // case 1 <---> case a , c
    else if( lv == 1 ){
      //case a
      if( len == 0 ){
        return await getList( id + '/1' )
      }
      // case c , paths = [viewkey]
      else if(len == 1){
        return await getMock( id + '/' + value ,  value)
      }
      // case d , paths = [viewkey , videoname]
      else if(len == 2){
        return await getMock( id + '/' + value ,  value)
      }
    }

    // case 2
    else if( lv == 2 ){
      // case b
      if( len == 0){
        return await getList( id  )
      }
      // case c
      else if(len == 1){
        return await getMock( {id : id + '/' + value,  name:value} )
      }
      // case d
      else if( len == 2){
        return await getMock( {id : id + '/' + value,  name:value} )
      }
    }

    // case 3
    else if( lv == 3 ){
      //不会存在此情况
      if( len == 0 ){
        
      }
      // case d , paths = [ videoname ]
      else if( len == 1){
        return getMock( {
          id : id + '/f' ,  
          name:decodeURIComponent(helper.decode(value)),
          ext:'mp4' ,
          mime:'video/mp4', 
          type:'video'
        })
      }

    }

    return []
  }

  /**
   * /f/viewkey
   */
  const file = async(id) =>{
    let viewkey = id.split('/').slice(-2,-1)
    if(viewkey){
      let resp = await getDetail( viewkey )
      return resp
    }else{
      return false
    }
  }

  return { name , version, protocols, folder , file }
}