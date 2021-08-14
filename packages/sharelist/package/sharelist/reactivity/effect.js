const { isArray, isObject, isMap, isSet } = require('./utils')

let shouldTrack = true
let activeEffect
const effectStack = []
const trackStack = []
const targetMap = new WeakMap()

const ITERATE_KEY = Symbol('')
const MAP_KEY_ITERATE_KEY = Symbol('')

const pauseTracking = () => {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

const enableTracking = () => {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

const resetTracking = () => {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

const effect = (fn, options = {}) => {
  const effectIns = function reactiveEffect() {
    if (!effectIns.active) {
      return fn()
    }
    if (!effectStack.includes(effectIns)) {
      clearEffect(effectIns)
      try {
        enableTracking()
        effectStack.push(effectIns)
        activeEffect = effectIns
        return fn()
      } catch (e) {
        console.log(e)
      } finally {
        effectStack.pop()
        resetTracking()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  }
  effectIns.active = true
  effectIns.deps = []
  effectIns.options = options
  return effectIns
}

const clearEffect = (effect) => {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

const stopEffect = (effect) => {
  if (effect.active) {
    clearEffect(effect)
    if (effect.options.onStop) {
      effect.options.onStop()
    }
    effect.active = false
  }
}

const track = (target, key) => {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

const trigger = (target, type, key, newValue, oldValue) => {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }

  const effects = new Set()

  const add = (dep = []) => dep.forEach((effect) => effects.add(effect))

  if (type == 'clear') {
    depsMap.forEach(add)
  } else if (key === 'length' && isArray(target)) {
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= newValue) {
        add(dep)
      }
    })
  } else {
    if (key) {
      add(depsMap.get(key))
    }

    switch (type) {
      case 'add':
        if (!isArray(target)) {
          //触发自身
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          add(depsMap.get('length'))
        }
        break
      case 'delete':
        if (!isArray(target)) {
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case 'set':
        if (isMap(target)) {
          add(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  effects.forEach((effect) => {
    if (effect !== activeEffect) {
      if (effect.options.scheduler) {
        effect.options.scheduler(effect)
      } else {
        effect()
      }
    }
  })
}

exports.effect = effect
exports.track = track
exports.trigger = trigger
exports.pauseTracking = pauseTracking
exports.enableTracking = enableTracking
exports.ITERATE_KEY = ITERATE_KEY
