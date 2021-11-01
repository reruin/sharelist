import http from 'http'
import { Context, WebDAVDepth } from './types'
import { parseXML } from './operations/shared'
import { URL } from 'url'

export default (req: http.IncomingMessage, base: string, allows: Array<string>): Context => {
  const authorization = req.headers?.authorization?.split(' ')[1]

  const path = new URL(req.url as string, `http://${req.headers.host}`).pathname
  const ctx: Context = {
    req: req,
    depth: req.headers?.depth as WebDAVDepth,
    method: (req.method as string || '').toLowerCase(),
    path: path.replace(base, ''),
    base,
    config: {},
    auth: { user: undefined, pass: undefined },
    allows,
    get(field: string): string | undefined {
      const req: http.IncomingMessage = this.req
      switch (field = field.toLowerCase()) {
        case 'referer':
        case 'referrer':
          return req.headers.referrer as string || req.headers.referer || ''
        default:
          return req.headers[field] as string || ''
      }
    }
  }
  if (authorization) {
    const pairs = Buffer.from(authorization, "base64").toString("utf8").split(':')
    ctx.auth = { user: pairs[0], pass: pairs[1] }
  }
  return ctx
}