const fnCache = new WeakMap()

type Fn = (...args: any[]) => any

const WORKER_SCRIPT = () => {
  const methodsMap: Record<string, Fn> = {}

  function invoke(name: string, params: unknown[], id: string) {
    try {
      if (!methodsMap[name]) {
        throw new Error('function ' + name + ' is not registered.')
      }
      const result = methodsMap[name].apply(null, params)
      Promise.resolve(result)
        .then(function onresolve(res) {
          self.postMessage(
            JSON.stringify({
              data: res,
              name: name,
              id: id,
            }),
          )
        })
        .catch(function onerror(error) {
          throw error
        })
    } catch (error) {
      throw error
    }
  }

  self.onmessage = function (e) {
    const data = JSON.parse(e.data)
    const type = data.type
    const name = data.name

    switch (type) {
      case 'add':
        methodsMap[name] = eval(data.code)
        break

      case 'remove':
        if (methodsMap[name]) {
          delete methodsMap[name]
        }
        break

      case 'clear':
        methodsMap = {}
        break

      case 'invoke':
        var params = data.params
        var id = data.id
        invoke(name, params, id)
        break
    }
  }
}

class WorkerFactory {
  worker: Worker

  constructor() {
    const url = URL.createObjectURL(new Blob([`(${WORKER_SCRIPT.toString()})()`]))
    this.worker = new Worker(url)
  }
}
export const useWorker = (fn: Fn) => {
  if (useWorker.instance) {
    return useWorker.instance
  }

  const name = fn.name
  const url = URL.createObjectURL(new Blob([WORKER_SCRIPT.toString()]))

  if (!fnCache.has(fn)) {
    const url = URL.createObjectURL(new Blob([__WORKER_SCRIPT__]))
    fnCache.set(fn, {
      name,
    })
  }
}
