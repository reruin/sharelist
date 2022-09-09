import { provide, inject, Ref, ref } from 'vue'

type InjectType = 'root' | 'optional'

export interface FunctionalStore<T> {
  (): T
  key?: symbol
  root?: T
}

export const regStore = <T>(store: FunctionalStore<T>): T => {
  if (!store.key) {
    store.key = Symbol('functional store')
  }
  const depends = store()
  provide(store.key, depends)
  return depends
}

export const useStore = <T>(store: FunctionalStore<T>, type?: InjectType): any => {
  const key = store.key
  const root = store.root

  switch (type) {
    case 'optional':
      return inject<T>(key) || store.root || null
    case 'root':
      if (!store.root) store.root = store()
      return store.root
    default:
      if (inject(key)) {
        return inject<T>(key)
      }
      if (root) return store.root
      throw new Error(`状态钩子函数${store.name}未在上层组件通过调用useProvider提供`)
  }
}

export const useAsync = (cb: (() => Promise<any>) | Promise<any>): Ref => {
  const val = ref()
  Promise.resolve(typeof cb === 'function' ? cb() : cb).then((resp) => {
    val.value = resp
  })
  return val
}

const jsbridge = {
  call: (name: string, param?: any, callback?: (value?: unknown) => void) => name,
  getGrayScaleValue: (v: any) => v,
}

type BridgeValue = {
  returnValue: string
}

type BridgeFunctions = 'getGrayScaleValue'

export const useBridgeValue = <T, P>(
  fn: BridgeFunctions,
  params: P,
): { value: Ref<T | undefined>; ready: Ref<boolean> } => {
  const value: Ref<T | undefined> = ref()
  const ready = ref(false)
  Promise.resolve(jsbridge[fn](params)).then((resp: T) => {
    value.value = resp
    ready.value = true
  })
  return { value, ready }
}

type GrayParams = 'code1' | 'code2'

type GrapValue = {
  returnValue: string
}
const { ready, value } = useBridgeValue('getGrayScaleValue', 'code')

type ICdpSpaceInfo = {
  returnValue: string
}
function getCdpSpaceInfo<T>(spaceCode: string): Promise<ICdpSpaceInfo> {
  return new Promise((resolve) => {
    jsbridge.call('getCdpSpaceInfo', { spaceCode }, (resp: unknown) => {
      resolve(resp as ICdpSpaceInfo)
    })
  })
}
