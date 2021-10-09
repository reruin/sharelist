import { Context, Response } from '../types'

export default async (ctx: Context): Promise<Response | undefined> => {
  const res = await ctx.driver?.('rm', ctx.path)
  if (res?.error) {
    return {
      status: res.error.code || '502'
    }
  } else {
    return {
      status: '204'
    }
  }
}