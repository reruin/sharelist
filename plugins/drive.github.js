/*
 * github
 * github 列目录
 * 支持标识 ：
 *  user                  -> reruin
 *  user/repo             -> reruin/sharelist
 * 仅支持公开库 
 */

const name = 'GitHub'

const version = '1.0'

const protocols = ['github']

const defaultProtocol = 'github'

const path = require('path')

const { URL } = require("url")

const { Writable } = require('stream')

const clientMap = {}

module.exports = ({ request , getConfig, base64 , extname }) => {

  const getContent = async (id) => {
    let p = id.split('/')
    // root
    if( p.length == 1 ){
      return await root(id)
    }
    else if(p.length > 1){

      let repo = p.slice(0,2).join('/')
      let path = p.slice(2).join('/')
      if(path && path.startsWith('/') == false){
        path = '/' + path
      } 
      let url = `https://api.github.com/repos/${repo}/contents${path}`

      let resp = await request.get(url , {json:true})

      let body = resp.body

      if( Array.isArray(body)){
        return body.map(i => ({
          id:id+'/'+i.name,
          name:i.name,
          protocol: defaultProtocol,
          size:i.size,
          created_at:'-',
          updated_at:'-',
          download_url:i.download_url,
          ext: extname(i.name),
          type: i.type === 'file' ? 'file' : 'folder'
        })) 
      }else{
        return {
          id:id+'/'+body.name,
          name:body.name,
          protocol: defaultProtocol,
          size:body.size,
          created_at:'-',
          updated_at:'-',
          download_url:body.download_url,
          ext: extname(body.name),
          type: body.type === 'file' ? 'file' : 'folder'
        }
      }
      
    }
    
  }

  const root = async (id) => {
    let url = `https://api.github.com/users/${id}/repos`
    let resp = await request.get(url,{json:true})
    // console.log(resp)
    return (resp.body || []).map(i => ({
      id:id+'/'+i.name,
      name:i.name,
      protocol: defaultProtocol,
      size:i.size,
      created_at:i.created_at,
      updated_at:i.updated_at,
      download_url:i.download_url,
      type: 'folder'
    }))
  }

  const folder = async (id) => {
    //let [server , path] = id.split('>');
    let children = await getContent(id)

    let resp = { id , type: 'folder', protocol: defaultProtocol , children , $cached_at: Date.now()}
    //cache.set(resid, resp)

    return resp
  }

  const file = async (id , { data = {} } = {}) => {
    if( data && data.download_url ){
      data.url = data.download_url
    }else{
      data = await getContent(id)
      data.url = data.download_url
    }
    // data.outputType = 'stream'
    //data.proxy = 'stream'
    return data
  }

  return { name, version, drive: { protocols, folder, file } }
}