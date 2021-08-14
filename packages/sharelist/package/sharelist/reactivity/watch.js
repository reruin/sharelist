
const { isReactive } = require('./reactive')
const { isFunction } = require('./utils')
const { effect } = require('./effect')
const { isObject, isArray, isPlainObject, hasChanged } = require('./utils')

const watch = (source, cb, { immediate, deep } = { immediate: false, deep: false }) => {
  let oldValue = {}
  let getter
  if (isReactive(source)) {
    getter = () => source
    deep = true
  } else if (isFunction(source)) {
    getter = source
  } else {
    getter = () => { }
  }
  if (cb && deep) {
    const baseGetter = getter
    getter = () => {
      return traverse(baseGetter())
    }
  }

  const job = () => {
    if (!runner.active) {
      return
    }
    if (cb) {
      let newValue = runner()
      if (deep || hasChanged(newValue, oldValue)) {
        cb(newValue, oldValue)
        oldValue = newValue
      }
    }
    // watchEffect
    else {
      runner()
    }
  }

  const scheduler = job
  const runner = effect(getter, {
    scheduler
  })

  if (cb) {
    if (immediate) {
      scheduler()
    } else {
      oldValue = runner()
    }
  } else {
    runner()
  }

  return () => {
    stopEffect(runner)
  }
}

const watchEffect = (effect, options) => {
  return watch(effect, null, options)
}

const traverse = (value, seen = new Set()) => {
  if (
    !isObject(value) ||
    seen.has(value)
  ) {
    return value
  }
  seen.add(value)
  if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
  return value
}

exports.watch = watch
exports.watchEffect = watchEffect