import { Context, Response } from '../types'
import commands from './commands'
export default async (ctx: Context): Promise<Response | undefined> => {
  return {
    status: '405 Method not allowed',
    headers: {
      'Allow': Object.keys(commands).join(', ')
    }
  }
}