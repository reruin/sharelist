const md = require('markdown-it')()

/*
 * 文档在线预览插件
 */
const name = 'documentParse'

const version = '1.0'

module.exports = ({ getSource }) => {

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

  const decodeUrl = (req) => {
    return req.path + ( req.querystring ? '?' + req.querystring.replace(/preview&?/,'') : '')
  }

  const office = async (data, req) => {
    return {
      ...data,
      body: `
        <iframe src="https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(req.origin+decodeUrl(req))}"></iframe>
      `
    }
  }

  const pdf = async (data , req) => {
    return {
      ...data,
      body: `
        <iframe src="//mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(req.origin+decodeUrl(req))}"></iframe>
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
