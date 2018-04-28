
const http = require('../utils/http')
const base = require('../utils/base')
const cache = require('../utils/cache')
const config = require('../config')
const format = require('../utils/format')

const nrop19 = {
  async folder(id , opts){
    opts = opts || {}
    let query = opts.query
    let paths = opts.paths_raw
    let root = {
      id : '91',
      type : 'folder',
      provider:'remote',
      updated_at:Date.now(),
      children : [
        {id:'91/default',cat:'default',name:'默认',type:'folder',provider:'remote'},
        {id:'91/rp',cat:'rp',name:'最近得分',type:'folder',provider:'remote'},
        {id:'91/rp',cat:'rf',name:'最近加精',type:'folder',provider:'remote'},
        {id:'91/hot',cat:'hot',name:'当前最热',type:'folder',provider:'remote'},
        {id:'91/top',cat:'top',name:'本月最热',type:'folder',provider:'remote'},
        {id:'91/tf',cat:'tf',name:'本月收藏',type:'folder',provider:'remote'},
        {id:'91/mf',cat:'mf',name:'收藏最多',type:'folder',provider:'remote'},
      ]
    }

    let cats = base.hash(root.children , 'cat')

    ids = id.split('/')

    if(ids.length == 1){
      // hack for filedown
      let viewkey = paths[paths.length-2]
      if(viewkey && /^[0-9a-z]{10,}$/.test(viewkey)){
        return {
          id : '91',
          type:'folder',
          provider:'remote',
          updated_at:Date.now(),
          children:[{
            name:viewkey , 
            id:'91/folder/'+viewkey,
            type:'folder',
            provider:'remote'
          }]
        }
      }else{
        return root
      }
    }
    else if(ids.length == 2){
      let cat = ids[1]
      let catname = cats[cat].name
      let page = query.page ? parseInt(query.page) : 1
      let parent_id = '91/'+cat

      let { body } = await http.get('http://www.91porn.com/v.php?page='+page+'&category='+cat)
      resp = []
      body.replace(/viewkey=([0-9a-z]+)[^<]+?\s*<img\s+src="([^"]+?)"[\w\W]+?title="([^"]+?)"/g , ($0 , $1, $2, $3)=>{
        resp.push({
          id : parent_id +'/'+$1, 
          parent:parent_id,
          name : $3,
          pathname:'../'+$1+'/'+$3+'.mp4',
          provider:'remote',
          updated_at:'-',
          size:'-',
          type:'video',
          ext:'mp4'
        })
        return ''
      })

      resp.push({
        id: parent_id +'/'+(page+1),
        name:'下一页',
        provider:'remote',
        type:'folder',
        href:'?page=' + (page+1)
      })

      if(page > 1){
        resp.unshift({
          id:parent_id +'/'+(page-1),
          name:'上一页',
          provider:'remote',
          type:'folder',
          href:'?page=' + (page-1)
        })
      }

      resp = {
        id : id + '_' +page,
        type:'folder',
        provider:'remote',
        updated_at:Date.now(),
        children:resp,
      }

      return resp
    }
    else if(ids.length == 3){
      let viewkey = ids[2]
      let {body} = await http.get('http://www.91porn.com/view_video.php?viewkey='+viewkey.replace('@','') , {fake:true})
      let url = (body.match(/source\s*src\s*=\s*"([^"]+)/) || ['',''])[1]
      let name =(body.match(/viewvideo-title">([^<]+)/) || ['',''])[1].replace(/[\r\n]/g,'').replace(/(^[\s]*|[\s]*$)/g,'') 
      let resp = {
        id : '91/folder/' + viewkey,
        name : viewkey,
        type : 'folder',
        provider:'remote',
        children:[
          {
            id:'91/detail/'+viewkey,
            name:name+'.mp4',
            type:'video',
            provider:'remote',
            url:url
          }
        ]
      }

      return resp
    }

  },

  async file(id , data){
    data.proxy_header = true
    return data
  }
}


const folder = async(id , query , paths) => {
  if(/^91/.test(id)){
    return await nrop19.folder(id , query , paths)
  }
}


const file = async(id  , data , root) => {
  if(/^91/.test(id)){
    return await nrop19.file(id , data , root)
  }
}

module.exports = { folder , file }