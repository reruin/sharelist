import { parseXML } from './shared'
import { Context, Response } from '../types'

export default async (ctx: Context): Promise<Response | undefined> => {
  return {
    status: '200'
  }
}