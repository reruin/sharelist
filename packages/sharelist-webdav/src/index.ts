//docs: https://github.com/FullStackPlayer/WebDAV-RFC4918-CN

import { WebDAVMethod, WebDAVRequest, Driver, DriverMethod, Context, Response, StatusCodes, WebDAVDepth } from "./types"
import Commands from './operations/commands'
import http from 'http'
import { parseXML } from './operations/shared'
import { URL } from 'url'

interface WebDAVAuth {
  (user: string | undefined, pass: string | undefined): boolean,
}
export type WebDAVServerOptions = {
  driver?: Driver,
  base?: string,
  auth: WebDAVAuth,
  redirect: boolean
}

export class WebDAVServer {
  public methods: { [methodName: string]: WebDAVMethod }

  protected unknownMethod: WebDAVMethod | undefined

  protected driver: Driver | undefined

  protected base: string

  protected auth: WebDAVAuth

  protected config: Record<string, any>

  protected allows: Array<string>

  constructor({ driver, base, redirect, auth }: WebDAVServerOptions = { redirect: false, auth: () => true }) {
    this.methods = {}
    this.driver = driver
    this.base = base || ''
    this.auth = auth
    this.config = { redirect }
    const commands: { [key: string]: any } = Commands
    for (const k in commands)
      if (k === 'NotImplemented')
        this.unknownMethod = commands[k]
      else
        this.methods[k.toLowerCase()] = commands[k]
    this.allows = Object.keys(this.methods).map(i => i.toUpperCase())//.join(', ')
  }

  createContext(req: http.IncomingMessage, options: WebDAVServerOptions): Context {

    const base = options?.base || this.base

    const authorization = req.headers?.authorization?.split(' ')[1]

    const path = new URL(req.url as string, `http://${req.headers.host}`).pathname

    const ctx: Context = {
      req: req,
      driver: this.driver,
      depth: req.headers?.depth as WebDAVDepth,
      method: (req.method as string || '').toLowerCase(),
      path: path.replace(base, ''),
      base,
      config: this.config,
      auth: { user: undefined, pass: undefined },
      allows: this.allows,
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

  async request(req: WebDAVRequest, options: WebDAVServerOptions): Promise<Response> {
    const ctx: Context = this.createContext(req, options)
    if (
      !(ctx.method == 'options' && !ctx.path) &&
      !this.auth(ctx.auth.user, ctx.auth.pass)
    ) {
      return {
        headers: {
          'X-WebDAV-Status': '401 ' + StatusCodes[401],
          'WWW-Authenticate': `Basic realm="ShareList WebDAV"`
        },
        status: '401'
      }
    }

    const method = this.methods[ctx.method] || this.unknownMethod
    const res: Response = await method(ctx)
    res.headers ||= {}
    if (res.status) {
      // res.headers['X-WebDAV-Status'] = res.status + ' ' + StatusCodes[res.status]
    }
    return res
  }
}