import { ref, Ref, reactive, unref, readonly, toRaw } from 'vue'
import { useApi, ReqResponse } from '@/hooks/useApi'

type IUseConfig = {
  (): any
  instance?: any
}

export const useConfig: IUseConfig = (): any => {
  if (useConfig.instance) {
    return useConfig.instance
  }
  const config: Record<string, any> = reactive({})
  const request = useApi()
  request.userConfig().then((resp: ReqResponse) => {
    if (!resp.error) {
      for (const i in resp.data) {
        config[i] = resp.data[i]
      }
      if (config.version) {
        console.log(
          `%c sharelist %c ${config.version} %c https://github.com/reruin/sharelist`,
          'color: #fff; background: #5f5f5f',
          'color: #fff; background: #4bc729',
          '',
        )
      }
    }
  })

  useConfig.instance = { config }

  return config
}
