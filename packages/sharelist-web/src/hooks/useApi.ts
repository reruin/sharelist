import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { effectScope, EffectScope, App, InjectionKey, getCurrentInstance, inject } from 'vue'

export const apiSymbol = Symbol('api') as InjectionKey<IUseApi>

// export type APIItemGroup = Array<[string, string | ((...args: Array<any>) => string), Record<string, any>]>
export type APIItem = [
  name: string,
  url: string | ((...args: Array<any>) => string),
  options?: {
    [key: string]: number | string | boolean | ((...rest: Array<any>) => any)
  },
]
export type APICall = (...rest: Array<any>) => Promise<AxiosResponse<ReqResponse>>

export interface IUseApi {
  install?: (app: App) => void
  _e?: EffectScope
  _m?: any //Record<string, APICall>
}

type RequestMethod = 'OPTIONS' | 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'CONNECT'

type ReqConfig = {
  url: string
  method: string
  data?: any
  params?: any
  responseType?: string
  token?: boolean
  headers?: any
}

axios.defaults.timeout = 60 * 1000

const service: AxiosInstance = axios.create()

// http response 拦截器
service.interceptors.response.use(
  (response) => {
    return response.data
  },

  (error) => {
    // 由接口返回的错误
    if (error.response) {
      return { error: { code: error.response.status, message: error.response.statusText } }
    } else {
      log(`服务器错误！错误代码：${error}`)
      return { error: { code: error?.code || 500, message: '' } }
    }
  },
)

const log = (content: string, type = 'error'): void => {
  console.log(content)
}

export type ReqResponse = {
  error?: { code: number; message?: string; scope?: Record<string, any> }
  [key: string]: any
  [key: number]: any
}

interface APIOptions {
  inScope?: boolean
  baseURL?: string
  onReq?: (d: Record<string, any>, itemOption: Record<string, any>) => void
  onRes?: <T>(d: T) => void
  onError?: (e: Error) => void
}
// const qs = (d: Record<string, string>) => Object.keys(d).map(i => `${i}=${encodeURI(d[i])}`).join('&')

const urlReplace = (url: string, params: Record<string, any>) =>
  url.replace(/(?:\:)([\w\$]+)/g, ($0, $1) => {
    if ($1 in params) {
      return params[$1]
    } else {
      return ''
    }
  })

const convFormData = (data: any) => {
  const fd = new FormData()
  for (const i in data) {
    if (Array.isArray(data[i])) {
      const item = []
      data[i].forEach((j: any, idx: number) => {
        fd.append(`${i}[${idx}]`, j)
      })
    } else {
      fd.append(i, data[i])
    }
  }
  return fd
}

export const useApi = (options?: APIOptions) => {
  if (globalApi) {
    return globalApi._m as any
  }

  const currentInstance = getCurrentInstance()

  const api = currentInstance && inject(apiSymbol)
  if (!api) {
    throw new Error(
      'getActiveApi was called with no active api. Did you forget to install?\n' +
      '\tconst api = createApi()\n' +
      '\tapp.use(api)\n' +
      `This will fail in production.`,
    )
  }

  return api._m as any
}

const globalApi: IUseApi = {}
export const createApi = (apis: unknown, options?: APIOptions): IUseApi => {
  type a = typeof apis
  const pareKey: any = {}
  for (const i of apis as Array<APIItem>) {
    pareKey[i[0]] = 1
  }
  const apiMap: Record<keyof typeof pareKey, APICall> = {}

  for (const i of apis as Array<APIItem>) {
    // pareKey[apis[0]] =
    apiMap[i[0]] = createRequest(i, options)
  }

  if (options?.inScope) {
    const scope = effectScope(true)
    const api: IUseApi = {
      install(app: App) {
        app.provide(apiSymbol, api)
        app.config.globalProperties.$api = api
      },
      _e: scope,
      _m: apiMap,
    }
    return api
  } else {
    globalApi._m = apiMap
    return globalApi
  }
}

function createRequest(api: APIItem, defaultOptions?: APIOptions): APICall {
  return (...args: Array<any>) => {
    const [name, url, options = {}] = api
    const reqUrl = typeof url === 'function' ? url(...args) : url

    let argsObj: Record<string, any> = {
      $R: Math.random(),
      $T: Date.now(),
    }

    if (typeof args[0] == 'object') {
      argsObj = { ...argsObj, ...args[0] }
    }

    args.forEach((key, idx) => {
      argsObj['$' + (idx + 1)] = key
    })

    const pairs = reqUrl.split(/\s/)
    const contentType = options.contentType || 'json'

    const params: any = {
      url: (defaultOptions?.baseURL || '') + urlReplace(pairs.slice(1).join(' '), argsObj),
      method: <RequestMethod>pairs[0] || 'GET',
      data: typeof args[0] == 'object' ? args[0] : {},
      headers: options.header || {},
    }

    if (options.params) {
      return params
    }
    // factory
    if (typeof params.data?.customRequest == 'function') {
      const ret: any = params.data.customRequest(params, options)
      delete params.data.customRequest
      if (ret) return ret
      // return (params, options) => { }
    }

    if (contentType == 'formdata') {
      params.headers['content-type'] = 'multipart/form-data'
      if (params.data) {
        params.data = convFormData(params.data)
      }
    } else if (contentType == 'stream') {
      params.headers['content-type'] = 'application/octet-stream'
      params.data = params.data.stream
    } else {
      params.headers['content-type'] = 'application/json'
    }

    defaultOptions?.onReq?.(params, options)

    return service.request<ReqResponse>(params as AxiosRequestConfig)
  }
}
