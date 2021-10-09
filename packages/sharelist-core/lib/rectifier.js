const { resolve4 } = require('dns')
const { Readable, Writable } = require('stream')

exports.createReadStream = function (readStream, { highWaterMark } = { highWaterMark: 10 * 1024 * 1024 }) {
  const buffers = []// 缓冲区

  let total = 0
  let tasks = []
  let ended = false
  const sliceBuffer = (n) => {
    let part = Buffer.alloc(n)
    let b
    let index = 0
    let flag = false
    while (null != (b = buffers.shift())) {
      for (let i = 0; i < b.length; i++) {
        part[index++] = b[i]
        if (index == n) {//填充完毕
          //将多出的部分存回头部
          b = b.slice(i + 1)
          buffers.unshift(b)
          flag = true
          break;
        }
      }
      if (flag) break;
    }
    total -= n
    return part
  }


  const check = () => {
    let task = tasks[0]

    if (task) {
      if (total >= task.size) {
        let chunk = sliceBuffer(task.size)
        task.done(chunk)
        tasks.shift()
      } else {
        if (ended) {
          let chunk = sliceBuffer(total)
          task.done(chunk)
          tasks.shift()
        }
      }
    }

    if (!ended) {
      if (tasks.length == 0 && total > highWaterMark) {
        readStream.pause()
      } else {
        if (readStream.isPaused()) {
          readStream.resume()
        }
      }
    }
  }

  const read = (size) => new Promise((resolve, reject) => {
    if (ended && total == 0) {
      resolve()
    } else {
      tasks.push({ size, done: resolve })
      check()
    }
  })


  readStream.on('data', (chunk) => {
    total += chunk.length
    buffers.push(chunk.slice(0))
    check()
  })

  readStream.on('end', () => {
    ended = true
    check()
    //let task = tasks.pop()
  })
  return { read }
}

exports.rectifier = function (size = 1 * 1024 * 1024, cb) {

  const buffers = []// 缓冲区

  let total = 0
  let part = 0
  let partSize = 0
  let cacheRate = 3

  const writable = new Writable({
    write(chunk, encoding, callback) {
      let bytesRead = chunk.length

      partSize += bytesRead
      total += bytesRead

      buffers.push(chunk.slice(0))

      //截取片段
      if (partSize >= size) {
        let n = size
        let partBuffer = Buffer.alloc(n)
        let b
        let index = 0
        let flag = false
        while (null != (b = buffers.shift())) {
          for (let i = 0; i < b.length; i++) {
            partBuffer[index++] = b[i]
            if (index == n) {//填充完毕

              //将多出的部分存回头部
              b = b.slice(i + 1)
              buffers.unshift(b)
              partSize = b.length
              flag = true
              break;
            }
          }
          if (flag) break;
        }

        // console.log('partSize', size, partSize, total)
        //缓冲
        if (partSize < size * cacheRate) {
          callback()
        }

        cb({ total, chunk: partBuffer, chunk_index: part++ }, () => {
          //callback()
        })
      } else {
        //继续写入
        callback()
      }
    },

    // 处理剩余的部分
    final(callback) {
      let n = total - size * part

      // 文件大小是 size 的倍数时
      if (n == 0) {
        callback()
        return
      }

      //处理掉剩余部分
      let partBuffer = Buffer.alloc(n)
      let b
      let index = 0
      while (null != (b = buffers.shift())) {
        for (let i = 0; i < b.length; i++) {
          partBuffer[index++] = b[i]
        }
      }

      cb({ total, chunk: partBuffer, chunk_index: part++, ended: true }, () => {
        callback()
      })
    }
  })


  return writable

}