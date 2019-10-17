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

  const office = async (data, req) => {
    return {
      ...data,
      body: `
        <iframe src="https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(req.origin+req.path)}"></iframe>
      `
    }
  }

  const preview = {};

  ['md'].forEach(ext => {
    preview[ext] = markdown
  });

  ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].forEach(ext => {
    preview[ext] = office
  });

  return { name, version, preview }
}
