import { Context, Response } from '../types'
import { URL } from 'url'

export default async (ctx: Context): Promise<Response | undefined> => {
  const dst = new URL(ctx.req.headers?.destination as string).pathname.replace(ctx.base, '')
  const src = ctx.path
  //The source URI and the destination URI are the same.
  if (src === dst) {
    return { status: '403' }
  }

  const res = await ctx.driver?.('mv', src, dst, true)
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