import { delayToggle, cancelablePromise, useState } from './useHooks'
import { documentVisibility, whenDocumentVisible } from './useDom'
import { reactive, ref, Ref, UnwrapRef, toRefs, watch, onUnmounted } from 'vue'

type Service<D, P extends any[]> = (...args: P) => Promise<D>

interface RequestOptions<T, P> {
  immediate?: boolean
  defaultParams?: P
  mutate?: (data?: T | ((oldData?: T) => T | undefined), disableRequest?: boolean) => void
  onBefore?: (param: P) => void
  onSuccess?: (data: T, param: P) => void
  onError?: (e: Error, param: P) => void
  onFinally?: (param: P, data?: T, e?: Error) => void
  loadingDelay?: number
  cacheKey?: string
  cacheTime?: number
  refreshDeps?: Array<any>
  ready?: Ref<boolean>
  pollingInterval?: number
  pollingWhenHidden?: boolean
}

type RequestState<D, P extends Array<any>> = {
  loading: boolean
  params?: P
  data?: D
  error?: Error
}

interface RequestActions<D, P extends Array<any>> {
  cancel: () => void
  refresh: () => void
  refreshAsync: () => Promise<D>
  run: (...param: P) => void
  runAsync: (...param: P) => Promise<D>
  mutate: (data: D) => void
}

interface RequestCore<D, P extends any[]> extends RequestActions<D, P> {
  state: RequestState<D, P>
  use: (plugins: Array<PluginResult<D, P>>) => void
}

type RequestResult<D, P extends any[]> = RequestActions<D, P> &
  {
    [prop in keyof RequestState<D, P>]: Ref<RequestState<D, P>[prop]>
  }

interface PluginResult<D, P extends any[]> {
  before?: (params: P) =>
    | ({
      stopNow?: boolean
      returnNow?: boolean
    } & Partial<RequestState<D, P>>)
    | void

  request?: (
    service: Service<D, P>,
    params: P,
  ) => {
    servicePromise?: Promise<D>
  }

  success?: (data: D, params: P) => void
  error?: (e: Error, params: P) => void
  finally?: (params: P, data?: D, e?: Error) => void
  cancel?: () => void
  mutate?: (data: D) => void
}

interface Plugin<D, P extends Array<any>> {
  (requestInstance: RequestCore<D, P>, options: RequestOptions<D, P>): PluginResult<D, P>
}

const requestCacheMap: Record<string, any> = {}

const useRequestCore = <D, P extends Array<any>>(service: Service<D, P>, options: RequestOptions<D, P> = {}) => {
  const [state, setState] = useState<RequestState<D, P>>({
    loading: false,
    params: undefined,
    data: undefined,
    error: undefined,
  })

  const plugins: Array<PluginResult<D, P>> = []

  //const loading = ref(false)
  // data: Ref<D | undefined> = ref()
  // params: Ref<any> = ref(options.defaultParams)

  state.params = options.defaultParams as P

  let canceled = false

  const emit = (type: keyof PluginResult<D, P>, ...rest: Array<any>) => {
    const r = plugins.map((i) => i[type]?.(...rest)).filter(Boolean)
    return Object.assign({}, ...r)
  }

  const runAsync = async (...params: P) => {
    //params.value = args
    canceled = false

    const { returnNow, ...newState } = emit('before', params)

    setState({
      loading: true,
      params,
      ...newState,
    })

    if (returnNow) {
      return Promise.resolve(state.data)
    }

    options.onBefore?.(params)

    try {
      let { service: servicePromise } = emit('request', service, params)
      if (!servicePromise) {
        servicePromise = service(...params)
      }
      const res = await servicePromise

      if (canceled) {
        return new Promise(() => { })
      }

      setState({
        data: res,
        error: undefined,
        loading: false,
      })

      options.onSuccess?.(res, params)
      emit('success', res, params)
      options.onFinally?.(params, res)
      emit('finally', res, params)
      return res
    } catch (error: any) {
      if (canceled) {
        return new Promise(() => { })
      }

      setState({
        error,
        loading: false,
      })

      options.onError?.(error, params)
      emit('error', error, params)

      options.onFinally?.(params, undefined, error)
      emit('finally', params, undefined, error)

      throw error
    }
  }

  const run = (...args: P) => {
    runAsync(...args).catch((e) => {
      if (!options.onError) {
        console.error(e)
      }
    })
  }

  const mutate = (data: D) => {
    emit('mutate', data)
    state.data = data
  }

  const cancel = () => {
    canceled = true
    state.loading = false
    emit('cancel')
  }

  const use = (usePlugins: Array<PluginResult<D, P>>) => {
    plugins.push(...usePlugins)
  }

  const refresh = () => {
    // @ts-expect-error: Unreachable code error
    run(...(state.params || []))
  }

  const refreshAsync = () => {
    // @ts-expect-error: Unreachable code error
    return runAsync(...(state.params || []))
  }

  onUnmounted(cancel)

  return {
    state,
    use,
    run,
    mutate,
    cancel,
    refresh,
    runAsync,
    refreshAsync,
  }
}

export const useRequest = <D, P extends Array<any> = Array<any>>(
  service: Service<D, P>,
  options: RequestOptions<D, P> = {},
  plugins?: Array<Plugin<D, P>>,
): RequestResult<D, P> => {
  const pluginsFactory = [...(plugins || []), useDelay, usePolling, useAuto] as Array<Plugin<D, P>>

  const requestInstance = useRequestCore<D, P>(service, options)

  requestInstance.use(pluginsFactory.map((plugin) => plugin(requestInstance, options)))

  const { loading, data, error, params } = toRefs(requestInstance.state)

  return {
    loading,
    error,
    data,
    params,
    run: requestInstance.run,
    runAsync: requestInstance.runAsync,
    mutate: requestInstance.mutate,
    cancel: requestInstance.cancel,
    refresh: requestInstance.refresh,
    refreshAsync: requestInstance.refreshAsync,
  }
}

const usePolling: Plugin<any, Array<any>> = (request, { pollingInterval, pollingWhenHidden = true }) => {
  if (!pollingInterval) return {}

  let timer: number, docVisibleWatcher: () => void
  const stop = () => {
    if (timer) {
      clearTimeout(timer)
    }
    docVisibleWatcher?.()
  }

  return {
    before() {
      stop()
    },
    finally() {
      if (!pollingWhenHidden && !documentVisibility.value) {
        docVisibleWatcher = whenDocumentVisible(request.refresh)
        return
      }
      timer = setTimeout(request.refresh, pollingInterval)
    },
    cancel() {
      stop()
    },
  }
}

const useDelay: Plugin<any, Array<any>> = (request, { loadingDelay = 0 }) => {
  if (!loadingDelay) return {}

  let timer: number

  const clear = () => {
    if (timer) {
      clearTimeout(timer)
    }
  }

  return {
    before() {
      clear()

      timer = setTimeout(() => {
        request.state.loading = true
      }, loadingDelay)

      return {
        loading: false,
      }
    },
    finally() {
      clear()
    },
    cancel() {
      clear()
    },
  }
}

const useAuto: Plugin<any, Array<any>> = (request, { ready = ref(true), immediate = false, refreshDeps = [] }) => {
  if (refreshDeps) {
    watch(refreshDeps, () => {
      request.refresh()
    })
  }

  if (immediate) {
    if (ready.value) request.refresh()
    else {
      watch(ready, (nv) => {
        if (nv) request.refresh()
      })
    }
  }

  return {
    before() {
      if (!ready || !ready.value) {
        return {
          stopNow: true,
        }
      }
    },
  }
}

/**
 * 
 * 
 * 
type CacheData<T, P> = {
  data: T
  param: P
  time: number
}
  const run = (...args: P) => {
    //params.value = args
    load.true()

    let err: Error

    runHandler = cancelablePromise(
      Promise.resolve(service(...args))
        .then((res: D) => {
          load.false()
          options.onSuccess?.(res, args)
          data.value = res
          if (options.cacheKey) {
            requestCacheMap[options.cacheKey] = {
              data: res,
              params: args,
              time: Date.now() + (options?.cacheTime || 300000),
            }
          }
        })
        .catch((e: Error) => {
          load.false()

          err = e
          if (!options.onError) {
            throw e
          } else {
            options.onError(e, args)
          }
        })
        .finally(() => {
          options.onFinally?.(args, data.value, err)
          if (options.pollingWhenHidden !== false && !documentVisibility.value) {
            docVisibleWatcher = whenDocumentVisible(refresh)
            return
          }

          if (options?.pollingInterval) {
            pollHandler = setTimeout(refresh, options.pollingInterval)
          }
        }),
    )
  }

  const mutate = (val: D, disable = false) => {
    data.value = val
    if (!disable) {
      runWrap(...([] as any))
    }
  }

  const cancel = () => {
    if (pollHandler) {
      clearTimeout(pollHandler)
    }
    docVisibleWatcher?.()
    runHandler?.()
  }

  const runWrap = (...args: P) => {
    if (args.length == 0 && lastArgs) {
      args = lastArgs
    } else {
      lastArgs = args
    }

    cancel()

    if (options.ready?.value === false) return
    if (options.cacheKey && requestCacheMap[options.cacheKey] && requestCacheMap[options.cacheKey].time < Date.now()) {
      return Promise.resolve(requestCacheMap[options.cacheKey].data as T)
    } else {
      return run(...args)
    }
  }

  const refresh = () => runWrap(...([] as any as P))

  if (options.refreshDeps) {
    watch(options.refreshDeps, () => {
      refresh()
    })
  }

  if (options?.immediate === true) {
    if (options.ready) {
      watch(options.ready, (nv) => {
        if (nv) refresh()
      })
    }

    refresh()
  }

 */
