import { watch, onUnmounted, ref, Ref } from 'vue'

type Type = 'file' | 'string'

const watchOnce = (v: any, cb: any) => {
  const handler = watch(
    v,
    (nv) => {
      if (nv !== undefined) {
        handler()
        cb(nv)
      }
    },
    { immediate: true },
  )

  return handler
}
export const useClipboard = (cb: (...rest: Array<any>) => any, type: Type = 'string') => {
  const node: Ref<Element | any> = ref()

  const handler = (event: any) => {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items
    const data: Array<any> = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === type) data.push(items[i])
    }
    if (type == 'file') {
      cb(data.map((i) => i.getAsFile()))
    } else if (type == 'string') {
      cb(data.map((i) => i.getAsString()))
    } else {
      cb(data)
    }
  }

  const cancel = watchOnce(node, () => {
    node.value.addEventListener('paste', handler)
  })

  onUnmounted(() => {
    cancel?.()
    node.value?.removeEventListener('paste', handler)
  })

  return { node }
}

export default (el: Element, type: Type, cb: (...rest: Array<any>) => any) => {
  const handler = (event: any) => {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items
    console.log(items)
    const data: Array<any> = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === type) data.push(items[i])
    }
    console.log(data, items.length, type, '<<')
    if (type == 'file') {
      cb(data.map((i) => i.getAsFile()))
    } else if (type == 'string') {
      cb(data.map((i) => i.getAsString()))
    } else {
      cb(data)
    }
  }
  el.addEventListener('paste', handler)

  return () => el.removeEventListener('paste', handler)
}
