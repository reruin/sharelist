const { track, trigger, pauseTracking, resetTracking, ITERATE_KEY } = require('./effect')
const { isObject, isArray, hasOwn, hasChanged } = require('./utils')

const arrayInstrumentations = createArrayInstrumentations()
const reactiveMap = new WeakMap()
const Flags = {
  IS_REACTIVE: Symbol('isReactive'),
  RAW: Symbol('raw')
}

function createArrayInstrumentations() {
  const instrumentations = {}
    // instrument identity-sensitive Array methods to account for possible reactive
    // values
    ; (['includes', 'indexOf', 'lastIndexOf']).forEach(key => {
      const method = Array.prototype[key]
      instrumentations[key] = function (scope, ...args) {
        const arr = [toRaw(scope)]
        for (let i = 0, l = this.length; i < l; i++) {
          track(arr, 'get', i + '')
        }
        // we run the method using the original args first (which may be reactive)
        const res = method.apply(arr, args)
        if (res === -1 || res === false) {
          // if that didn't work, run it again using raw values.
          return method.apply(arr, args.map(toRaw))
        } else {
          return res
        }
      }
    })
    // instrument length-altering mutation methods to avoid length being tracked
    // which leads to infinite loops in some cases (#2137)
    ; (['push', 'pop', 'shift', 'unshift', 'splice']).forEach(key => {
      const method = Array.prototype[key]
      instrumentations[key] = function (...args) {
        pauseTracking()
        const res = method.apply(this, args)
        resetTracking()
        return res
      }
    })
  return instrumentations
}

const reactive = (data, shallow = false) => {
  if (!isObject(data) || (data[Flags.RAW] && data[Flags.IS_REACTIVE])) {
    return data
  }

  const existingProxy = reactiveMap.get(data)
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy(data, {
    get(target, key, receiver) {
      if (key === Flags.IS_REACTIVE) {
        return true
      }
      else if (key === Flags.RAW && receiver === reactiveMap.get(target)) {
        return target
      }

      if (isArray(target) && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }

      const res = Reflect.get(target, key, receiver)
      track(target, key)

      if (!shallow && isObject(res)) {
        return reactive(res, shallow)
      }

      return res
    },
    set(target, key, value, receiver) {
      let oldValue = target[key]
      if (!shallow) {
        value = toRaw(value)
        oldValue = toRaw(oldValue)
      }
      const hadKey =
        isArray(target) && isIntegerKey(key)
          ? Number(key) < target.length
          : hasOwn(target, key)

      const result = Reflect.set(target, key, value, receiver)
      if (target === toRaw(receiver)) {
        if (!hadKey) {
          trigger(target, 'add', key, value)
        } else if (hasChanged(value, oldValue)) {
          trigger(target, 'set', key, value, oldValue)
        }
      }
      return result
    },
    deleteProperty(target, key) {
      const hasKey = hasOwn(target, key)
      const oldValue = target[key]
      const result = Reflect.deleteProperty(target, key)
      if (result && hasKey) {
        trigger(target, 'delete', key, undefined, oldValue)
      }
      return result
    },
    ownKeys(target) {
      track(target, isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  })

  reactiveMap.set(data, proxy)

  return proxy
}

const isReactive = (value) => {
  return !!value[Flags.IS_REACTIVE]
}

const toRaw = (observed) => {
  return (
    (observed && toRaw(observed[Flags.RAW])) || observed
  )
}

exports.isReactive = isReactive
exports.reactive = reactive