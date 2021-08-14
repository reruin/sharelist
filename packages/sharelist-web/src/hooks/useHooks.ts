import { ref, reactive, Ref, UnwrapRef } from 'vue'
import { onBeforeRouteLeave, useRouter, RouteLocationRaw } from 'vue-router'

type ToggleValue = number | string | boolean | undefined

export const useToggle = (defaultValue: ToggleValue = false, reverseValue: ToggleValue = undefined): any => {
  if (reverseValue === undefined) {
    reverseValue = !Boolean(defaultValue)
  }

  const state: Ref<ToggleValue> = ref(defaultValue)

  const toggle = () => {
    state.value = state.value === defaultValue ? reverseValue : defaultValue
  }

  const setLeft = () => (state.value = defaultValue)

  const setRight = () => (state.value = reverseValue)

  return { state, toggle, setLeft, setRight }
}

export const useBoolean = (defaultValue = false): any => {
  const state: Ref<boolean> = ref(defaultValue)

  const toggle = () => {
    state.value = state.value === true ? false : true
  }

  const setTrue = () => (state.value = true)

  const setFalse = () => (state.value = false)

  return [state, { toggle, setTrue, setFalse }]
}

export const useObject = (defaultValue: Record<string, any>): [any, (k?: Array<string>) => void] => {
  const state = reactive(defaultValue)

  const clear = (excludes: Array<string> = []): void => {
    Object.keys(state as Record<string, any>)
      .filter((i) => !excludes.includes(i))
      .forEach((key: string) => Reflect.deleteProperty(state as Record<string, any>, key))
  }

  return [state, clear]
}

export const useState = <T extends Record<string, any>>(initialState: T = {} as T): [T, (state: T) => T, () => T] => {
  const state = reactive(initialState)
  const setState = (val: T, clear = false) => {
    Object.keys(val).forEach((key) => {
      Reflect.set(state, key, val[key])
    })
    return state as T
  }

  const clearState = () => {
    Object.keys(state).forEach((key) => Reflect.deleteProperty(state, key))
    return state as T
  }

  return [state as T, setState, clearState]
}

const singleHook = new WeakMap()
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const useSingle = (hook: any, args: Array<any>): any => {
  if (singleHook.has(hook)) {
    return singleHook.get(hook)
  }
  const res = hook.apply(hook, args)
  singleHook.set(hook, res)
  return res
}

const useBoot = (cb: () => any): any => { }
// const useBoot = (cb: any) => {
//   useBoot.ready = true

//   if (useBoot.ready) {
//     cb()
//   }
// }

// const useWindowEvent = (event: string) => {
//   const handler = new Set()
//   const eventMap = new Map()
//   window.addEventListener(event, (event) => {
//     console.log('location: ' + document.location + ', state: ' + JSON.stringify(event.state))
//   })

//   const onMessage = (cb: any) => {
//     handler.add(cb)
//   }

//   const initListener = () => {
//     if (document) {
//       document.addEventListener('message', (e) => {
//         console.log(e)
//       })
//     }
//   }

//   initListener()

//   return {
//     onMessage,
//   }
// }
