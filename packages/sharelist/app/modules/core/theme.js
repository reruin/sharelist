const fs = require('fs')

const path = require('path')

module.exports = (themeDir = []) => {
  let themes = []

  const scanMeta = () => {
    let dirs = themeDir.filter(Boolean)
    let ret = {}
    for (let dir of dirs) {
      try {
        let files = fs.readdirSync(dir)
        for (let i of files) {
          let filepath = path.join(dir, i)
          let file = fs.statSync(filepath)

          if (file.isDirectory()) {
            let id = path.basename(i)
            ret[id] = filepath
          }
        }
      } catch (e) {
        console.log(e)
      }
    }
    themes = ret
  }

  const getFile = (file, theme) => {
    const themePath = themes[theme || 'default']
    if (themePath) {
      return path.join(themePath, file)
    } else {
      return ''
    }
  }

  const get = (id) => {
    scanMeta()
    return id ? themes[id] : Object.keys(themes)
  }

  scanMeta()

  return {
    getFile,
    get
  }

}