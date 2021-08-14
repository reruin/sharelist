import { getCurrentInstance, isRef, onMounted as vueOnMounted, onUnmounted as vueOnUnmounted, Ref } from 'vue'

export const onMounted = (cb: () => any): void => {
  const instance = getCurrentInstance()
  if (instance) {
    if (instance?.isMounted) {
      cb()
    } else {
      vueOnMounted(cb)
    }
  }
}

export function onUnmounted(cb: () => any): void {
  if (getCurrentInstance()) {
    vueOnUnmounted(cb)
  }
}
