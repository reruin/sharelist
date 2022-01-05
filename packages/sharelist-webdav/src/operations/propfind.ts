import { parseXML } from './shared'
import { Context, Response } from '../types'
import xml2js from 'xml2js'

const DEFAULT_PROPS = [
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
const propParse = (data: any) => {
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

/**
 * Create webdav responese xml by data and props options
 *
 * @param {object} [data] file data
 * @param {object} [options]
 * @param {object} [options.props] Available props
 * @param {object} [options.path]  Current folder path
 * @param {object} [options.ns]
 * @return {string} XML string
 */

const convData = (files: Array<any>, options: any) => {
  const { path, base = '', depth, prop, ns: { prefix, uri } } = options

  return files.map((file: any) => {
    const item: Record<string, any> = {}
    for (const key of prop) {
      item[key] = file.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

      if (key == 'getcontentlength') {
        item[key] = parseInt(file.size || 0)
      } else if (key == 'resourcetype') {
        item[key] = file.type == 'folder' ? { collection: '' } : ''
        // } else if (key == 'getcontenttype') {
        //   item[key] = file.mime
      } else if (key == 'creationdate' && file.ctime) {
        item[key] = new Date(file.ctime).toUTCString()
      } else if (key == 'getlastmodified' && file.mtime) {
        item[key] = new Date(file.mtime).toUTCString()
      }
    }

    const href = (base + path + (depth == '0' ? '' : ('/' + encodeURIComponent(file.name)))).replace(/\/{2,}/g, '/')
    //if (file.type == 'file' && file.download_url) href = file.download_url
    return {
      href,
      propstat: {
        status: 'HTTP/1.1 200 OK',
        prop: item
      }
    }
  })
}

const fixNs = (data: any, prefix: string) => {
  if (!prefix) return data
  Object.keys(data).forEach((key: string) => {
    const val = data[key]
    if (key != '$' && prefix) {
      if (Array.isArray(val) || typeof val == 'object') {
        fixNs(val, prefix)
      }
      delete data[key]
      data[`${prefix}:${key}`] = val
    } else {
      if (val.xmlns) {
        val[`xmlns:${prefix}`] = val.xmlns
        delete val.xmlns
      }
    }
  })
  return data
}

const createXML = (data: any, options: any) => {
  const { ns: { prefix, uri } } = options

  const obj: any = {
    multistatus: {
      response: convData(data || [], options)
    }
  }
  if (uri) {
    obj.multistatus.$ = {
      "xmlns": uri
    }
  }

  const builder = new xml2js.Builder({
    renderOpts: { pretty: false },
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  })

  const xml = builder.buildObject(fixNs(obj, prefix))
  return xml
}

export default async (ctx: Context): Promise<Response | undefined> => {
  const options = Object.assign({
    path: ctx.path,
    base: ctx.base,
    depth: ctx.depth,
  }, propParse(await parseXML(ctx.req)))
  const data: any = ctx.depth == '0' ? await ctx.driver?.('stat', ctx.path) : await ctx.driver?.('ls', ctx.path)
  if (!data) return { status: '404' }

  if (data.error) {
    if (data.error.code == 401) {
      // Windows seems to require this being the last header sent
      // (changed according to PECL bug #3138)
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
  }

  //return itself
  if (ctx.depth == '0') {
    if (!data.files) {
      return {
        status: '207',
        headers: {
          'content-type': 'text/xml; charset="utf-8"'
        },
        body: createXML([data], options)
      }
    }
  }
  else if (ctx.depth == '1') {
    if (data.files) {
      return {
        status: '207',
        headers: {
          'content-type': 'text/xml; charset="utf-8"'
        },
        body: createXML(data.files, options)
      }
    }
  }
  else if (ctx.depth == 'infinity') {
    return {
      status: '404'
    }
  }
}