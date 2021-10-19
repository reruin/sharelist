import { parseXML } from './shared'
import { Context, Response } from '../types'

const filterHeaders = (headers: Record<string, any>): Record<string, any> => {
  const effectFields = ['range', 'accept-encoding']
  const ret: Record<string, any> = {}
  Object.keys(headers).filter((i: string) => effectFields.includes(i.toLocaleLowerCase())).forEach((key: string) => {
    ret[key] = headers[key]
  })
  return ret
}

export default async (ctx: Context): Promise<Response | undefined> => {
  const res = await ctx.driver?.('get', ctx.path, { reqHeaders: filterHeaders(ctx.req.headers) })
  if (res?.error) {
    return {
      status: res.error.code || '502'
    }
  } else {
    return res as Response
  }
}