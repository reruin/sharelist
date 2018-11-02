/*
 * url 后缀解析插件
 * 用于:url后缀的文件直接跳转实际页面
 */

const name = 'urlParse'

const version = '1.0'

module.exports = ({getSource}) => {

  const process = async (data)=>{
    let content = await getSource(data.id , data.protocol)
    let url = content.match(/(?<=URL=)[^\r\n\t]+/)[0]
    data.url = url
    data.outputType = 'redirect'
    return data
  }

  const format = {
    'url': process
  }

  return { name , version ,  format }
}