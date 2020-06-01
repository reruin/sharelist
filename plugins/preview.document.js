const md = require('markdown-it')()

const qs = require('querystring')

/*
 * 文档在线预览插件
 */
const name = 'documentParse'

const version = '1.0'

module.exports = ({ getSource , getConfig, request }) => {

  const fileMap = {}

  const markdown = async (data, req) => {
    let html = md.render(await getSource(data.id , data.protocol));
    //<iframe style="width:auto;height:auto;"></iframe><script>document.querySelector("iframe").contentWindow.document.write(`'+html+'`);</script>
    return {
      ...data,
      body: '<link href="https://cdn.bootcss.com/github-markdown-css/3.0.1/github-markdown.min.css" rel="stylesheet"><article class="markdown-body" style="text-align:left;padding:16px;" itemprop="text">'+html+'</article>'
    }
  }

  const txt = async (data ,req) => {
    if(data.size && data.size > 512 * 1000){
      return {
        ...data,
        body:'<p style="margin:16px;font-size:13px;">内容过大，请直接下载</p>'
      }
    }

    let html = await getSource(data.id , data.protocol)
    return {
      ...data,
      body: '<link href="https://cdn.bootcss.com/github-markdown-css/3.0.1/github-markdown.min.css" rel="stylesheet"><article class="markdown-body" style="text-align:left;padding:16px;" itemprop="text"><p style="font-size:13px;line-height:1.8em;">'+html+'</p></article>'
    }
  }

  const createUrl = (req , withToken = false) => {
    let query = req.query || {}
    delete query.preview
    if(withToken){
      query.token = getConfig('token')
    }
    let querystr = qs.stringify(query)
    return req.origin + req.path + ( querystr ? ('?' + querystr) : '')
  }


  const office = async (data, req) => {
    if( req.query.conv && fileMap[req.path]){
      let url = fileMap[req.path]
      delete fileMap[req.path]
      return {
        ...data,
        convertible:true,
        outputType:'stream',
        body:request({url})
      }
    }

    let rawUrl = createUrl(req,true)
    rawUrl = 'https://sharelist.reruin.net/%E6%9C%AC%E5%9C%B0%E6%96%87%E4%BB%B6/preview/work.docx'
    let WOPISrc = encodeURIComponent(`http://us1-view-wopi.wopi.live.net:808/oh/wopi/files/@/wFileId?wFileId=${encodeURIComponent(rawUrl)}`)

    let url = `https://us1-word-view.officeapps.live.com/wv/wordviewerframe.aspx?ui=zh-CN&rs=zh-CN&WOPISrc=${WOPISrc}&access_token_ttl=0`
    let resp = await request.get(url,{ headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'}})
    let previewUrl
    if(resp.body){
      let z = (resp.body.match(/(?<=z\=)[a-z0-9]+?(?=\')/i) || [''])[0]
      if(z){
        previewUrl = `https://us1-word-view.officeapps.live.com/wv/WordViewer/Document.pdf?WOPIsrc=${WOPISrc}&access_token=1&access_token_ttl=0&z=${z}&type=accesspdf`
      }
    }

    if(previewUrl) {
      fileMap[req.path] = previewUrl
      let url = req.origin + req.path + '?' + qs.stringify({ preview:1, conv:1 })
      let body = `<iframe src="//mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}"></iframe>`
      return {
        ...data,
        convertible:true,
        body
      }
      
    }else{
      return { 
        ...data,
        convertible:true,
        body:'无法预览'
      }
    }
    
  }

  const pdf = async (data , req) => {
    return {
      ...data,
      body: `
        <iframe src="//mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(createUrl(req))}"></iframe>
      `
    }
  }

  const preview = {};

  ['md'].forEach(ext => {
    preview[ext] = markdown
  });
  ['txt'].forEach(ext => {
    preview[ext] = txt
  });
  ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].forEach(ext => {
    preview[ext] = office
  });

  ['pdf'].forEach(ext => {
    preview[ext] = pdf
  })

  return { name, version, preview }
}
