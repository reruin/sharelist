import { parseXML, propParse } from './shared'
import { Context, Response } from '../types'

export default async (ctx: Context): Promise<Response | undefined> => {
  // const options = Object.assign({
  //   path: ctx.path,
  //   base: ctx.base,
  //   depth: ctx.depth,
  // }, propParse(await parseXML(ctx.req)))
  return {
    status: '200'
  }
}