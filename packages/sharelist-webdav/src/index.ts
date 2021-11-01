
import { WebDAVMethod, WebDAVRequest, Driver, DriverMethod, Context, Response, StatusCodes } from "./types"
import Commands from './operations/commands'
import { default as createContext } from './context'

interface WebDAVAuth {
  (user: string | undefined, pass: string | undefined): boolean,
}
export type WebDAVServerOptions = {
  driver?: Driver,
  base?: string,
  auth: WebDAVAuth,
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

  protected auth: WebDAVAuth

  protected config: Record<string, any>

  protected allows: Array<string>

  constructor({ driver, base, redirect, auth }: WebDAVServerOptions = { redirect: false, auth: () => true }) {
    this.methods = {}
    this.driver = driver || VirtualDriver
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

  async request(req: WebDAVRequest, options?: WebDAVServerOptions): Promise<Response> {
    const ctx: Context = createContext(req, options?.base || this.base, this.allows)
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

    ctx.driver = this.driver
    ctx.config = this.config
    const method = this.methods[ctx.method] || this.unknownMethod

    const res: Response = await method(ctx)
    res.headers ||= {}
    if (res.status) {
      // res.headers['X-WebDAV-Status'] = res.status + ' ' + StatusCodes[res.status]
    }
    return res
  }
}