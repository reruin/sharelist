
import { WebDAVMethod, WebDAVRequest, Driver, DriverMethod, Context, Response } from "./types"
import Commands from './operations/commands'
import { default as createContext } from './context'

export type WebDAVServerOptions = {
  driver?: Driver,
  base?: string,
  redirect: boolean
}

const VirtualDriver: Driver = (actions: DriverMethod, options: any): any => {
  console.log(`VirtualDriver ${actions}`, options)
  return false
}

export class WebDAVServer {
  public methods: { [methodName: string]: WebDAVMethod }

  protected unknownMethod: WebDAVMethod | undefined

  protected driver: Driver | undefined

  protected base: string

  protected config: Record<string, any>

  protected allow: string

  constructor({ driver, base, redirect }: WebDAVServerOptions = { redirect: false }) {
    this.methods = {}
    this.driver = driver || VirtualDriver
    this.base = base || ''
    this.config = { redirect }
    const commands: { [key: string]: any } = Commands
    for (const k in commands)
      if (k === 'NotImplemented')
        this.unknownMethod = commands[k]
      else
        this.methods[k.toLowerCase()] = commands[k]
    this.allow = Object.keys(this.methods).map(i => i.toUpperCase()).join(', ')
  }

  async request(req: WebDAVRequest): Promise<Response> {
    const ctx: Context = createContext(req, this.base)
    ctx.driver = this.driver
    ctx.config = this.config
    ctx.allow = this.allow
    const method = this.methods[ctx.method] || this.unknownMethod

    const res = await method(ctx)
    if (res.status) {
      res.headers ||= {}
      // res.headers['X-WebDAV-Status'] = res.status
    }
    return res
  }
}