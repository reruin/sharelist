import { parseXML } from './shared'
import { Context, Response } from '../types'

export default async (ctx: Context): Promise<Response | undefined> => {
  const data = await ctx.driver?.('mkdir', ctx.path)
  if (data?.error) {
    if (data.error.code == 401) {
      return {
        headers: {
          'WWW-Authenticate': `Basic realm="ShareList WebDAV"`
        },
        status: '401'
      }
    } else {
      return {
        status: '404'
      }
    }
  } else {
    return {
      status: '201'
    }
  }
}