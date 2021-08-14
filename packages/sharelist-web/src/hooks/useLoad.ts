import { ref, Ref } from 'vue'

export const useLoad = (cb: (() => Promise<any>) | Promise<any>): Ref<boolean> => {
  const loading = ref(false)
  Promise.resolve(cb).then(() => {
    loading.value = true
  })
  return loading
}
