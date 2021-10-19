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