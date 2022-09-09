import * as http from 'http'
import { Readable } from 'stream'
import { parseStringPromise, processors } from 'xml2js'

const saveStream = (stream: Readable, charset: BufferEncoding | undefined = 'utf8'): Promise<string> => {
  return new Promise((resolve, reject) => {
    const data: Array<Uint8Array> = []
    stream
      .on('data', chunk => {
        data.push(chunk)
      })
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(data).toString(charset)))
  })
}


export const parseXML = async (req: http.IncomingMessage): Promise<any> => {
  const txt = await saveStream(req)
  return await parseStringPromise(txt, {
    // explicitChildren: true,
    explicitArray: false,
    tagNameProcessors: [processors.stripPrefix]
  })
}


export const DEFAULT_PROPS = [
  'displayname',
  'getcontentlength',
  'resourcetype',
  // 'getcontenttype',
  'creationdate',
  'getlastmodified'
]

/**
 * Parse props from webdav request
 * 
 * @param {object} [data]
 * @return {object|boolean}
 */
export const propParse = (data: any) => {
  if (!data) return {
    ns: { prefix: 'D', uri: 'DAV:' },
    prop: [...DEFAULT_PROPS]
  }
  let prop = [...DEFAULT_PROPS]
  const prefix = Object.keys(data.propfind.$).find(i => i.startsWith('xmlns:'))?.split(':')[1] || ''
  const uri = data.propfind.$?.[`xmlns${prefix ? `:${prefix}` : ''}`] || ''
  if (data.propfind.hasOwnProperty('prop')) {
    prop = Object.keys(data.propfind.prop)
  }
  return { ns: { prefix, uri }, prop }
}