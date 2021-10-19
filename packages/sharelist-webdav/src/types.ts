import http from 'http'

export type DriverMethod = 'stat' | 'get' | 'ls' | 'rm' | 'mkdir' | 'upload' | 'mv'

export type WebDAVDepth = "0" | "1" | "1,noroot" | "infinity"

export type WebDAVRequest = http.IncomingMessage

export type DriverMethodResponse = {
  status?: string,
  data?: any,
  error?: { code?: string | number, message: string }
}

export type Driver = {
  // [key in DriverMethod]: (options: any) => any
  (actions: DriverMethod, ...options: Array<any>): DriverMethodResponse
}

export type WebDAVAuthRecord = {
  user: string | undefined,
  pass: string | undefined
}
export interface Context {
  req: http.IncomingMessage,
  depth: WebDAVDepth,
  method: string,
  path: string | undefined,
  base: string,
  get(field: string): any,
  driver?: Driver,
  allows?: Array<string>,
  config: Record<string, any>,
  auth: WebDAVAuthRecord
}


export interface WebDAVMethod {
  (ctx: Context): any
}

export type Response = {
  status: string | number,
  headers?: Record<string, string | undefined>,
  body?: any
}

export const StatusCodes: Record<string | number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  207: 'Multi Status',
  302: 'Moved Temporarily',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  423: 'Locked'
}