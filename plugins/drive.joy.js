/*
 * joy://joy/?cat&page&id
 */
const name = 'joy'

const version = '1.0'

const protocols = ['joy']

const defaultProtocol = 'joy'

const { URL } = require('url')

const urlFormat = require('url').format

const cache = {}

const parse = (id) => {
  let data = new URL(id)
  let ret = {}
  let credentials = { client_id : data.host }
  for (const [key, value] of data.searchParams) {
    ret[key] = value
  }
  return ret
}

const format = (data) => {
  return urlFormat({
    protocol: 'joy',
    slashes:true,
    hostname: 'joy',
    query: data,
  })
}

module.exports = ({request , getConfig , getSource , getRandomIP , wrapReadableStream , base64 }) => {
  
  const host = base64.decode('aHR0cHM6Ly93d3cueHZpZGVvcy5jb20=')

  const PAGE_SIZE = 27

  let last_update = Date.now()

  let cats = []

  const mount = async () => {
    return {
      id : '/',
      type : 'folder',
      protocol:defaultProtocol,
      updated_at:Date.now(),
      children : (await getCats()).map(i=>{
        return {id:i.id , name:i.name , type:'folder',protocol:defaultProtocol}
      })
    }
  }

  const getCats = async() => {

    if(cats.length == 0){
      let resp = await request.header(`${host}/change-country/cn` , {followRedirect : false})
      let cookies = resp['set-cookie'].join('; ')

      resp = await request.get(host , {headers:{'Cookie':cookies}})

      resp.body.replace(/<span[^>]+><\/span>/g,'').replace(/<li class="dyn[^>]+?><a[\w\W]+?href="([^"]+?)"[^>]*?>([^<]+?)<\/a><\/li>/g,($0,$1,$2)=>{
        cats.push({
          id:format({cat:base64.encode($1)}),
          name : $2.replace(/^\s*/,'')
        })
        return ''
      })

    }

    return cats
  }

  const getNameByCate = (cate) => {
    let hit = cats.find( i => i.cat == cate)
    if( hit ){
      return hit.name
    }else{
      return '默认'
    }
  }

  const getFileSize = async (url , headers) => {
    let nh = await request.header(url , {headers})
    if(nh && nh['content-length']){
      return nh['content-length']
    }else{
      return null
    }
  }

  const getCatePageCount = async (cate) => {
    let pageCount

    if( cache[`${cate}_page_count`] && last_update && ( Date.now() - last_update < getConfig('max_age_dir')) ){
      pageCount = cache[`${cate}_page_count`]
    }else{
      
      //console.log(host+url)
      let url = getListUrl(cate)
      let { body } = await request.get(host+url)

      let hit = body.match(/(?<=<span\sclass=\"sub\">)[^\<]+/g)

      if(hit === null){
        hit = body.match(/(?<=<a\s*class=\"btn\s*btn-default\s*current\">)[^\<]+/g)
      }

      if(hit){
        pageCount = Math.ceil( parseInt(hit.pop().replace(/[^\d]/g,'') || 0) / PAGE_SIZE )
      }

      cache[`${cate}_page_count`] = pageCount

      last_update = Date.now()
    }

    return pageCount
  }

  const getListUrl = (cate , page = 1) => {
    cate = base64.decode(cate)
    let url 
    if(cate.startsWith('/porn') || cate.startsWith('/lang')){
      url = cate + '/' + page
    }
    else if(cate.startsWith('/c')){
      url = cate.replace('/c','/c/'+page)
    }
    else if(cate.startsWith('/?k=')){
      url = cate+'&p='+page
    }
    else if(/^\/s\:\/\//.test(cate)){
      url = cate.replace('s://','?k=') + '&p=' + page
    }
    else{
      url = '/new/' + page
    }
    return url
  }

  const getList = async (cat , page) => {
    let url = getListUrl(cat , page)
    let { body } = await request.get(host+url)
    let data = []

    body.replace(/<img[\w\W]+?data-src="([^"]+?)"[\w\W]+?<a href="([^"]+?)"\s+title="([^"]+?)"/g , ($0 , $1, $2, $3)=>{
      data.push({
        id:format({cat , page , id:base64.encode($2)}),
        img : $1,
        protocol:defaultProtocol,
        name : $3+'.mp4',
        type:'video',
        ext:'mp4',
        mime:'video/mp4',
      })
    })

    return data
  }


  const folder = async(id , { req }) => {

    if( id == '/' ) id = 'joy://joy'

    if(id.startsWith(defaultProtocol) == false) id = defaultProtocol + ':' + id
      
    if( cache[id] && cache[id].$cached_at && ( Date.now() - cache[id].$cached_at < getConfig('max_age_dir')) ){
      return cache[id]
    }

    const data = parse(id)
    
    if(data.search){
      data.cat = base64.encode('/?k='+data.search)
    }

    if(!data.cat){
      return await mount() 
    }
    else{
      let ret
      //具体页
      if( data.page ){
        ret = {
          id,
          name:`第${data.page}页`,
          type:'folder',
          protocol:defaultProtocol,
          children:await getList(data.cat , data.page),
        }
      }
      //范围页
      else{
        let catName = data.search ? 'search' : await getNameByCate(data.cat)
        let catePageTotal = await getCatePageCount(data.cat)

        ret = {
          id,
          name:catName,
          type:'folder',
          protocol:defaultProtocol,
          children:new Array(catePageTotal).fill(1).map((i , index) => {
            return {
              id : format({cat:data.cat , page:index+1}), 
              name : `第${index+1}页`,
              protocol:defaultProtocol,
              updated_at:'-',
              size:'-',
              type:'folder',
            }
          })
        }
      }

      ret['@cached_at'] = Date.now()
      cache[id] = ret
      return ret
    }
  }

  const file = async(id) =>{
    let data = parse(id)
    if(cache[data.id]){
      return cache[data.id]
    }

    let path = base64.decode(data.id)

    let { body } = await request.get(host+path)


    let url_low = (body.match(/setVideoUrlLow\('([^'"]+?)'/) || ['',''])[1]

    let url_high = (body.match(/setVideoUrlHigh\('([^'"]+?)'/) || ['',''])[1]

    let url_hls = (body.match(/setVideoHLS\('([^'"]+?)'/) || ['',''])[1]

    let thumb = (body.match(/setThumbUrl169\('([^'"]+?)'/) || ['',''])[1]

    let thumbslide = (body.match(/setThumbSlide\('([^'"]+?)'/) || ['',''])[1]

    let title = (body.match(/setVideoTitle\('([^'"]+?)'/) || ['',''])[1]

    let ret = {
      id,
      name: title,
      protocol: defaultProtocol,
      url:url_high,
      type:'video',
      ext:'mp4',
      mime:'video/mp4',
    }
    cache[data.id] = ret

    return ret
  }

  const createReadStream = async ({id , options = {}} = {}) => {
    let r = await file(id)
    if(r){
      let readstream = request({url:r.url ,headers:r.headers, method:'get'})
      // let passThroughtStream = new PassThrough()
      // let ret = readstream.pipe(passThroughtStream)
      return wrapReadableStream(readstream , { size: r.size } )
    }
  }

  return { name , version, drive : { protocols, folder , file , createReadStream } }
}