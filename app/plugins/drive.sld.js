/*
 * xdrive 是 sharelist 内置的使用yaml描述的网盘系统 , 没有缓存
 * xd: rootId(yaml文件所在路径) + yaml文件名 + ':' + 排序
 */

const name = 'ShareListDrive'

const version = '1.0'

const protocols = ['sld','xd']

const defaultProtocol = 'xd'

const yaml = require('yaml')

module.exports = ({isObject , isArray}) => {

  const diskMap = {}

  const getDisk = (id) => {
    let [rootId , diskPath] = id.split('->')
    return {
      disk:diskMap[rootId] , 
      path:(diskPath || '').replace(/^\/+/,'').split('/')
    }
  }

  /* 递归生成 索引 id */
  const createId = (d, rootId) => {
    d.forEach((i, index) => {
      if (isObject(i)) {
        i.id = rootId + '/' + i.name.replace(/\.d\.ln$/, '').replace(/\.ln$/, '')
        i.protocol = defaultProtocol
        if (i.children) {
          i.type = 'folder'
          i.protocol = defaultProtocol
          createId(i.children, i.id)
        } else {
          i.ext = i.name.split('.').pop()
        }

      } else if (isArray(i)) {
        createId(i, rootId)
      }
    })
    return d
  }

  const mount = async (rootId, data) => {
    let resp = { id: rootId, type: 'folder', protocol: defaultProtocol }

    if (data) {
      let json = yaml.parse(data)

      json = createId(json, rootId + '->')
      resp.children = json
      resp.updated_at = Date.now()

      diskMap[rootId] = resp

      return resp
    } else {
      return undefined
    }
  }

  const findById = (id) => {
    let { disk , path } = getDisk(id)
    if(disk){
      for (let i = 0; i < path.length && disk; i++) {
        disk = disk.children
        disk = disk.find(j => {
          return `${j.name}` == path[i]

          if (j.type == 'folder') {
            return `${j.name}.${j.ext}` == path[i]
          } else {
            return `${j.name}` == path[i]
          }
        }) //[ parseInt(path[i]) ]
      }

      return disk
    }else{
      return []
    }
  }

  const folder = async (id, data) => {
    if (data.content) {
      return mount(id, data.content)
    } else {
      return findById(id)
    }
  }

  const file = async (id) => {
    let data = findById(id)
    return data
  }

  return { name, version, drive: { protocols, folder, file } }
}
