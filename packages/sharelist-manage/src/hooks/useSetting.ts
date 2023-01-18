import { ref, Ref, reactive } from 'vue'
import { useApi, ReqResponse } from '@/hooks/useApi'
import { message } from 'ant-design-vue'
import { useBoolean } from './useHooks'
import { saveFile } from '../utils/format'
import useStore from '@/store/index'

type IUseSetting = {
  (): IUseSettingResult
  instance?: any
}
export interface IUseSettingResult {
  configFields: Ref<Array<fieldGroup>>
  signout(): any
  reload(): any
  loginState: Ref<number>
  isLoading: Ref<boolean>
  getValue(key: string): any

  config: any
  setConfig(data: ISetting, msg?: string): Promise<any>
  getConfig(token: string): void
  exportConfig(): void
  clearCache(): void

  getPlugin(id: string): Promise<string>
  setPlugin(id: string, data: string): Promise<any>
  removePlugin(id: string): Promise<any>
  upgradePlugin(id: string): Promise<any>
  reloadConfig(): void
}
export type ConfigFieldItem = {
  code: string
  label: string
  help?: string
  secret?: boolean
  type: 'string' | 'number' | 'boolean' | 'option' | 'array' | 'textarea'
  handler?: (...rest: any) => void
  validator?: (...rest: any) => boolean
}
type fieldGroup = {
  title: string
  children: Array<ConfigFieldItem>
}

const fields: Array<fieldGroup> = [
  {
    title: '常规',
    children: [
      { code: 'title', label: '网站标题', type: 'string' },
      {
        code: 'manage_path',
        label: '后台地址',
        type: 'string',
        help: '地址必须以 / 开头',
        validator: (val) => /^\//.test(val),
        handler: (nv: string, ov: string) => (location.href = location.href.replace(ov, nv)),
      },
      { code: 'token', label: '后台密码', type: 'string', secret: true },
      { code: 'proxy_enable', label: '全局代理', type: 'boolean' },
      { code: 'index_enable', label: '目录浏览', type: 'boolean' },
      {
        code: 'proxy_override_content_type',
        label: '代理时重写Content-Type',
        help: '此项是为了兼容某些挂载源，因返回内容的content type异常，导致无法在线播放的问题。',
        type: 'boolean',
      },
      {
        code: 'anonymous_download_enable',
        label: '允许下载',
        type: 'boolean',
        help: '禁用此项后，预览也将不可用。',
      },
      {
        code: 'expand_single_disk',
        label: '展开单一挂载盘',
        help: '只有一个挂载盘时，直接展示改挂载盘内容。',
        type: 'boolean',
      },
      {
        code: 'per_page',
        label: '列表分页大小',
        help: '设置分页将自动禁用缓存。某些挂载源可能不支持自定义分页大小。0 表示不分页。',
        type: 'number',
      },
    ],
  },
  {
    title: '外观',
    children: [
      { code: 'theme', label: '主题', type: 'option' },
      { code: 'script', label: '自定义脚本', type: 'textarea' },
      { code: 'style', label: '自定义样式', type: 'textarea' },
    ],
  },
  {
    title: '传输设置',
    children: [
      { code: 'proxy_url', label: '代理地址', help: '当前支持 HTTP/HTTPS 代理。', type: 'string' },
      { code: 'plugin_source', label: '插件源', type: 'option' },
    ],
  },
  {
    title: 'WebDAV',
    children: [
      { code: 'webdav_enable', label: '启用 WebDAV', type: 'boolean' },
      { code: 'webdav_path', label: 'WebDAV 路径', type: 'string' },
      { code: 'webdav_proxy', label: 'WebDAV 代理', type: 'boolean' },
      { code: 'webdav_user', label: 'WebDAV 用户名', type: 'string' },
      { code: 'webdav_pass', label: 'WebDAV 密码', type: 'string' },
    ],
  },
]

export const useSetting: IUseSetting = (): IUseSettingResult => {
  if (useSetting.instance) {
    return useSetting.instance
  }
  const request = useApi()
  const store = useStore()
  const config: ISetting = reactive({})
  const [isLoading, { setFalse: hideLoading }] = useBoolean(true)

  const loginState = ref(0)

  const configFields: Ref<Array<fieldGroup>> = ref(fields)

  const getConfig = (val: string) => {
    store.saveToken(val)
    request.setting().then((resp: ReqResponse) => {
      if (resp.error) {
        if (resp.error.code == 401) {
          store.saveToken('')
          loginState.value = 2
          if (resp.error.message) {
            message.error(resp.error.message)
          }
        }
      } else {
        loginState.value = 1
        updateSetting(resp.data as ISetting)
      }

      hideLoading()
    })
  }

  const setConfig = (data: ISetting, msg = '已保存') => {
    // console.log(data)
    return request.saveSetting(data).then((resp: ReqResponse) => {
      if (resp.error) {
        message.error(resp.error.message || 'error')
      } else {
        updateSetting(resp.data as ISetting)
        // return Promise.resolve(true)
        message.success(msg)
      }
    })
  }

  const reloadConfig = () => {
    getConfig(store.accessToken)
  }

  const updateSetting = (data: ISetting) => {
    for (const i in data) {
      config[i] = data[i]
    }
    configFields.value = [...fields, ...config.pluginConfig.map((i: any) => ({ title: i.name, children: i.config }))]
  }

  const getValue = (code: string) => {
    return config[code]
  }

  const signout = () => {
    store.removeToken()
    loginState.value = 2
    Object.keys(config).forEach((key) => Reflect.deleteProperty(config, key))
  }

  const reload = () => {
    request.reload().then((resp: any) => {
      // hidden()
      if (resp.error) {
        message.error(resp.error?.message)
      } else {
        message.success('操作成功')
      }
    })
  }

  const clearCache = () => {
    // const hidden = message.loading('正在清除缓存', 0)
    request.clearCache().then((resp: any) => {
      // hidden()

      if (resp.error) {
        message.error(resp.error?.message)
      } else {
        message.success('操作成功')
      }
    })
  }

  const exportConfig = () => {
    request.exportSetting().then((resp: any) => {
      // hidden()
      if (resp.error) {
        message.error(resp.error?.message)
      } else {
        saveFile(JSON.stringify(resp.data), 'config.json')
      }
    })
  }

  const getPlugin = async (id: string): Promise<string> => {
    return request.plugin(id).then((resp: any) => {
      if (resp.error) {
        message.error(resp.error?.message)
      } else {
        return resp.data
      }
    })
  }

  const setPlugin = async (id: string, data: string): Promise<any> => {
    const res = await request.savePlugin({ id, data })
    if (res.error) {
      message.error(res.error?.message)
      throw new Error(res.error?.message)
    } else {
      message.success('保存成功')
      reloadConfig()
    }
  }

  const removePlugin = async (id: string): Promise<any> => {
    const res = await request.removePlugin(id)
    if (res.error) {
      message.error(res.error?.message)
      //throw new Error(res.error?.message)
    } else {
      message.success('删除成功')
      reloadConfig()
    }
  }

  const upgradePlugin = async (id: string): Promise<any> => {
    const res = await request.upgradePlugin(id)
    if (res.error) {
      message.error(res.error?.message)
      //throw new Error(res.error?.message)
    } else {
      message.success('更新成功')
      reloadConfig()
    }
  }

  if (!config.token && store.accessToken) {
    getConfig(store.accessToken)
  } else {
    loginState.value = 2
    hideLoading()
  }

  return (useSetting.instance = {
    signout,
    reload,
    loginState,
    isLoading,
    getValue,

    configFields,
    config,
    setConfig,
    getConfig,
    exportConfig,
    clearCache,

    getPlugin,
    setPlugin,
    removePlugin,
    upgradePlugin,
    reloadConfig,
  })
}

export const useConfig: IUseSetting = (): any => {
  const config: Record<string, any> = reactive({})
  const request = useApi()

  request.config().then((resp: ReqResponse) => {
    if (!resp.error) {
      for (const i in resp.data) {
        config[i] = resp.data[i]
      }
    }
  })

  return { config }
}
