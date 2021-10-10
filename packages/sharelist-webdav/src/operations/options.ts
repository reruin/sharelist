import { parseXML } from './shared'
import { Context, Response } from '../types'

export default async (ctx: Context): Promise<Response | undefined> => {
  const dav = [1]

  if (ctx.allows?.includes('LOCK')) {
    dav.push(2)
  }

  return {
    headers: {
      // For Microsoft clients
      'MS-Author-Via': 'DAV',
      'DAV': dav.join(', '),
      'Allow': ctx.allows?.join(', ') || ''
    },
    status: '200'
  }
}