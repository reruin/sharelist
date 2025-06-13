import { ref, Ref, reactive, UnwrapRef } from 'vue'

interface RequestOptions<T, P> {
  immediate?: boolean
  isNoMore?: (data?: T) => boolean
  onSuccess?: (data: T) => void
  onError?: (e: Error) => void
  target?: Ref<Element>
  threshold?: number
}

interface actions<T> {
  setNode(el: Element, target: Element | Window): void
  scrollTo(pos: number): void
  cancel: () => void
  isScroll: Ref<boolean>
}

type useScrollOption = {
  list: any[]
  [key: string]: any
}
export const useScroll = <T extends useScrollOption, P extends Array<any>>(
  service: (args?: T) => Promise<T>,
  options: RequestOptions<T, P> = {},
): actions<T> => {
  let el: Element
  const isScroll = ref(false)
  const setNode = (v: Element, target: Element | Window) => {
    if (el) {
      cancel()
    }
    el = v
    target.addEventListener('scroll', onDomScroll)
  }

  const cancel = () => {
    el?.removeEventListener('scroll', onDomScroll)
  }

  const onDomScroll = throttle(() => {
    const { clientHeight, scrollTop, scrollHeight } = el
    isScroll.value = scrollTop > 0
    if (scrollHeight - scrollTop - clientHeight < (options?.threshold || 100)) {
      service()
    }
  }, 200)

  const scrollTo = (v: number) => {
    if (el) {
      el.scrollTo({ top: v })
    }
  }
  return {
    setNode,
    cancel,
    scrollTo,
    isScroll,
  }
}

const throttle = function (fn: () => any, delay = 0) {
  let now: number,
    last = 0,
    timer: number | null,
    context: any,
    args: Array<any> | null

  const later = function () {
    last = now
    fn.apply(context, <[]>args)
    timer = null
    context = args = null
  }

  const listen = function (this: any, ...rest: Array<any>) {
    args = rest

    now = Date.now()

    //剩余时间
    const remaining = delay - (now - last)

    if (remaining <= 0 || remaining > delay) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }

      last = now

      fn.apply(this, <[]>rest)
      if (!timer) context = args = null
    } else if (!timer) {
      timer = setTimeout(later, remaining)
    }
  }

  return listen
}
