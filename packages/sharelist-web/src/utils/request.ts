import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import apis, { IAPI } from '../config/api'
import router from '../router'
import storage from 'store2'

type ReqConfig = {
  url: string
  method: string
  data?: any
  params?: any
  responseType?: string
  token?: boolean
  headers?: any
}

export type ReqResponse = {
  error?: { code: number; message?: string }
  [key: string]: any
  [key: number]: any
}

const methods: string[] = ['post', 'get', 'put', 'head', 'delete', 'patch']

const baseURL = ''

axios.defaults.timeout = 60 * 1000
axios.defaults.baseURL = baseURL

const service: AxiosInstance = axios.create()

// http response 拦截器
service.interceptors.response.use(
  (response) => {
    return response.data
  },

  (error) => {
    // 由接口返回的错误
    if (error.response) {
      switch (error.response.status) {
        case 401:
          router.push('error/401')
        case 403:
          router.push('error/403')
      }
      return { status: 500 }
    } else {
      log(`服务器错误！错误代码：${error}`)
      return { status: 500, msg: '' }
    }
  },
)

const log = (content: string, type = 'error'): void => {
  console.log(content)
}

const urlReplace = (url: string, params: any): string =>
  url.replace(/(?:\:)([\w\$]+)/g, ($0, $1) => {
    if ($1 in params) {
      return params[$1]
    } else {
      return $0
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

const createReq = (opts: ReqConfig) => {
  if (opts.token !== false) {
    if (!opts.headers) {
      opts.headers = {}
    }
    const token: string = storage.get('ACCESS_TOKEN')
    if (token) {
      opts.headers['Authorization'] = `${token}`
    }
  }

  if (opts.headers['Content-Type'] == 'multipart/form-data') {
    opts.data = convFormData(opts.data)
  }
  return service.request<ReqResponse>(opts as AxiosRequestConfig)
}

const request: any = (name: string) => request[name]
/*
{
  call(name:string , ...rest:any){
    return request[name](...rest)
  }
}
*/
methods.forEach((method: string) => {
  request[method] = (options: any = {}) =>
    createReq({
      method,
      headers: {
        'Content-Type': options.type == 'json' ? 'application/json' : 'multipart/form-data',
      },
      ...options,
    })
})

apis.forEach((item: IAPI) => {
  request[item[0]] = (...args: any[]) => {
    let url = item[1]
    if (typeof url === 'function') {
      url = url(...args)
    }
    const t = url.split(/\s/)
    const method: string = t[0] || 'GET'
    let argsObj: any = {}
    if (typeof args[0] == 'object') {
      argsObj = { ...args[0] }
    }
    args.forEach((key, idx) => {
      argsObj['$' + (idx + 1)] = key
    })
    url = t.slice(1).join(' ')
    url = urlReplace(url, argsObj)
    const options: any = item[2] || {}

    const params: any = {
      method,
      url,
    }

    if (params.method == 'GET') {
      if (argsObj.qs) {
        params['params'] = argsObj.qs
      }
    } else {
      params['data'] = args[0] || options.data || {}
    }
    params.headers = params.headers || {}
    params.responseType = options.responseType

    if (options.type == 'formdata') {
      params.headers['Content-Type'] = 'multipart/form-data'
    } else {
      params.headers['Content-Type'] = 'application/json'
    }
    // console.log(params)
    if (options.token) {
      params.token = true
    }
    return createReq(params)
  }
})

export default request
