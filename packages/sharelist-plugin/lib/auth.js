
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

  onListed(async (data, query) => {
    let hit = data?.files.find(i => i.name == config.acl_file)
    if (hit) {
      let auth = query?.auth

      if (auth) {
        let content

        if (cache[hit.id]) {
          content = cache[hit.id]
        } else {
          await safeCall(async () => {
            content = yaml.parse(await driver.getContent(hit.id))
          })
        }

        if (content) {
          cache[hit.id] = content

          if (authMethods?.[content.type]('' + auth, content.data, app)) {
            return data
          }
        }

        return { error: { code: 401, message: 'Invalid password' } }
      } else {
        return { error: { code: 401, message: 'Invalid password' } }
      }
    }

    return data
  })

}