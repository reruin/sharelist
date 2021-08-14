import { ref, Ref, reactive, unref, readonly } from 'vue'
import request, { ReqResponse } from '@/utils/request'
import storage from 'store2'
import { message } from 'ant-design-vue'
import { useBoolean } from './useHooks'

type IUseSetting = {
  (): any
  instance?: any
}
export const useSetting: IUseSetting = (): any => {
  if (useSetting.instance) {
    return useSetting.instance
  }

  const config: ISetting = reactive({})
  const [isLoading, { setFalse: hideLoading }] = useBoolean(true)
  const loginState = ref(0)

  const getConfig = (val: string) => {
    storage.set('ACCESS_TOKEN', val)
    request.setting().then((resp: ReqResponse) => {
      if (resp.error) {
        if (resp.error.code == 401) {
          storage.remove('ACCESS_TOKEN')
          loginState.value = 2
          if (resp.error.message) {
            message.error(resp.error.message)
          }
        }
      } else {
        config.value = resp.data
        loginState.value = 1
        updateSetting(resp.data as ISetting)
      }

      hideLoading()
    })
  }

  const setConfig = (data: ISetting) => {
    // console.log(data)
    request.saveSetting(data).then((resp: ReqResponse) => {
      if (resp.error) {
        message.error(resp.error.message || 'error')
      } else {
        updateSetting(resp.data as ISetting)
      }
    })
  }

  const updateSetting = (data: ISetting) => {
    for (const i in data) {
      config[i] = data[i]
    }
  }

  const getValue = (code: string) => {
    return config[code]
  }

  const signout = () => {
    storage.remove('ACCESS_TOKEN')
    loginState.value = 2
    Object.keys(config).forEach((key) => Reflect.deleteProperty(config, key))
  }

  // eslint-disable-next-line prettier/prettier
  const noop = () => { }

  const clearCache = () => {
    // const hidden = message.loading('正在清除缓存', 0)
    request.clearCache().then((resp: any) => {
      // hidden()
      if (resp.status) {
        message.error(resp.msg)
      } else {
        message.success('操作成功')
      }
    })
  }

  if (!config.token && storage.get('ACCESS_TOKEN')) {
    getConfig(storage.get('ACCESS_TOKEN'))
  } else {
    loginState.value = 2
    hideLoading()
  }

  return (useSetting.instance = {
    signout,

    loginState,
    isLoading,
    getValue,

    config,
    setConfig,
    getConfig,
    clearCache,
  })
}

export const useConfig: IUseSetting = (): any => {
  const config: Record<string, any> = reactive({})

  request.config().then((resp: ReqResponse) => {
    if (!resp.error) {
      for (const i in resp.data) {
        config[i] = resp.data[i]
      }
    }
  })

  return { config }
}
