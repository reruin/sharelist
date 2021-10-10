import http from 'http'
import { Context, WebDAVDepth } from './types'
import { parseXML } from './operations/shared'

export default (req: http.IncomingMessage, base: string): Context => {
  const value = req.headers?.authorization?.split(' ')[1]
  const ctx: Context = {
    req: req,
    depth: req.headers?.depth as WebDAVDepth,
    method: (req.method as string || '').toLowerCase(),
    path: req.url?.replace(base, ''),
    base,
    config: {},
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
  if (value) {
    const pairs = Buffer.from(value, "base64").toString("utf8").split(':')
    ctx.auth = { user: pairs[0], pass: pairs[1] }
  }
  return ctx
}