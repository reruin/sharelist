import { parseXML } from './shared'
import { Context, Response } from '../types'

export default async (ctx: Context): Promise<Response | undefined> => {
  console.log('>>', ctx.req.isPaused(), ctx.req.headers)
  ctx.req.headers.connection = 'keep-alive'
  const size = parseInt(ctx.req.headers['content-length'] || '0')
  const res = await ctx.driver?.('upload', ctx.path, ctx.req, { size })

  if (res?.error) {
    return {
      status: res.error.code || '502'
    }
  } else {
    return {
      status: '201'
    }
  }
}