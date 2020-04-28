const HOST = '此处填写sharelist的访问地址'
const TOKEN = '此处填写sharelist的后台口令'

const utils = {
  isPlainObject(obj) {
    if (typeof obj !== 'object' || obj === null) return false

    let proto = obj
    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto)
    }
    return Object.getPrototypeOf(obj) === proto
  },
  isType(v, type) {
    return Object.prototype.toString.call(v) === `[object ${type}]`
  },
  getRange(r, total) {
    if (!r) return [0, total - 1]
    let [, start, end] = r.match(/(\d*)-(\d*)/) || [];
    start = start ? parseInt(start) : 0
    end = end ? parseInt(end) : total - 1
    return [start, end]
  },
  parserHeaders(headers) {
    let ret = {}
    for (let pair of headers.entries()) {
      ret[pair[0].toLowerCase()] = pair[1]
    }
    console.log(ret)
    return ret
  },
  async request(url) {
    let response = await fetch(url, { method: 'GET' })
    return await response.json()
  },
  notfound() {
    return new Response('404 Not found', { status: 404 })
  }
}

async function handleRequest({ headers, method, url }) {
  let req = new URL(url)
  let pathname = req.pathname

  if (pathname == '/') return utils.notfound()

  let reqHeaders = utils.parserHeaders(headers)
  let mergeHeaders = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
  }
  let resp = await utils.request(`${HOST}${pathname}?forward=1&token=${TOKEN}`)
  if (resp) {
    let { url, headers = {}, size, error } = resp
    if (error) {
      return new Response(error.msg || '404 Not Found', { status: error.status || 404 })
    }
    let resHeaders = {},
      status = 200
    if (size) {
      resHeaders['accept-ranges'] = 'bytes'

      if (reqHeaders.range) {
        let [start, end] = utils.getRange(reqHeaders.range, size)
        resHeaders['content-range'] = `bytes ${start}-${end}/${size}`
        size = end - start + 1
      } else {
        resHeaders['content-range'] = `bytes 0-${size-1}/${size}`
      }
      status = 206
      resHeaders['content-length'] = size
    }

    let extraHeaders = resp.headers || {}
    let output = fetch(url, { method: 'GET', headers: { ...mergeHeaders, ...reqHeaders, ...extraHeaders } })
    return output.then(r => new Response(r.body, {
      status: status,
      headers: { ...utils.parserHeaders(r.headers), ...resHeaders }
    }))
  } else {
    return utils.notfound()
  }
}

addEventListener('fetch', event => event.respondWith(handleRequest(new Request(event.request))
  .catch(e => utils.notfound())))
