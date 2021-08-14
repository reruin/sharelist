let queued = false
const queue = []
const p = Promise.resolve()

exports.nextTick = (fn) => p.then(fn)

exports.queueJob = (job) => {
  if (!queue.includes(job)) queue.push(job)
  if (!queued) {
    queued = true
    nextTick(flushJobs)
  }
}

const flushJobs = () => {
  for (let i = 0; i < queue.length; i++) {
    queue[i]()
  }
  queue.length = 0
  queued = false
}