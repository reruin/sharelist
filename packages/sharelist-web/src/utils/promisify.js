const customArgumentsToken = '__ES6-PROMISIFY--CUSTOM-ARGUMENTS__'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function promisify(original) {
  if (typeof original !== 'function') {
    throw new TypeError('Argument to promisify must be a function')
  }

  const argumentNames = original[customArgumentsToken]

  return function (...args) {
    return new Promise((resolve, reject) => {
      // Append the callback bound to the context
      args.push(function callback(err, ...values) {
        if (err) {
          return reject(err)
        }

        if (values.length === 1 || !argumentNames) {
          return resolve(values[0])
        }

        const o = {}
        values.forEach((value, index) => {
          const name = argumentNames[index]
          if (name) {
            o[name] = value
          }
        })

        resolve(o)
      })

      // Call the function.
      original.apply(this, args)
    })
  }
}
