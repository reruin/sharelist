import { parseXML, propParse } from './shared'
import { Context, Response } from '../types'

export default async (ctx: Context): Promise<Response | undefined> => {
  const options = Object.assign({
    path: ctx.path,
    base: ctx.base,
    depth: ctx.depth,
  }, propParse(await parseXML(ctx.req)))
  console.log('PROPPATCH:', options)
  return {
    status: '200'
  }
}