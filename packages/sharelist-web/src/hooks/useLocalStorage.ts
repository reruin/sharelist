import { Ref, ref, watch } from 'vue'

export type LocalStateKey = string

export function useLocalStorageState<T = any>(key: LocalStateKey, defaultValue?: T | (() => T)): any {
  const raw = localStorage.getItem(key)
  if (raw) {
    try {
      defaultValue = JSON.parse(raw)
    } catch {
      //
    }
  }
  if (typeof defaultValue === 'function') {
    defaultValue = (defaultValue as () => T)()
  }
  const state = ref(defaultValue) as Ref<T | undefined>

  const setState = () => {
    localStorage.setItem(key, JSON.stringify(state.value))
  }

  watch(
    state,
    (nv) => {
      setState()
    },
    { deep: true, immediate: false },
  )

  return state
}
