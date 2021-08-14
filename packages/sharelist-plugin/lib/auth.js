
const authMethods = {
  'basic': (key, data) => {
    return data.find(i => '' + i == key)
  },
  'http': (key, data, { request }) => {
    let { data: res } = request(data.replace('{key}', key), { responseType: 'text' })
    return res === 'success'
  }
}

const cache = {}

module.exports = (app) => {
  const { onListed, config, driver, utils: { yaml, safeCall } } = app

  onListed(async (file, query) => {

    if (file.error) return file

    let hit = file?.files.find(i => i.name == config.acl_file)

    if (hit) {
      let { auth } = query

      if (auth) {
        let content

        if (cache[hit.id]) {
          content = cache[hit.id]
        } else {
          await safeCall(async () => {
            content = yaml.parse(await driver.getContent(hit.id))
          })
        }

        console.log(content, auth)
        if (content) {
          cache[hit.id] = content

          if (authMethods?.[content.type]('' + auth, content.data, app)) {
            return file
          }
        }

        file.error = { code: 401, message: 'Invalid password' }
      } else {
        file.error = { code: 401 }
      }

    }
  })

}