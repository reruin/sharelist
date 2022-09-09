const { resolve4 } = require('dns')
const { Readable, Writable, PassThrough } = require('stream')
const request = require('./request')

//限速
const throttleStream = (stream) => {
  stream.pause()

  setTimeout(() => {
    stream.resume()
  }, 1000)
}

exports.streamReader = function (readStream, { highWaterMark } = { highWaterMark: 10 * 1024 * 1024 }) {
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
        // 直接暂停 可能导致客户端 timeout
        throttleStream(readStream)

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

const createStream = options => {
  const stream = new PassThrough({
    highWaterMark: options?.highWaterMark || 1024 * 512,
  });
  stream._destroy = () => { stream.destroyed = true; };
  return stream;
};


const retry = (run, retryTimes = 3, maxTime = 6000) => new Promise((resolve, reject) => {
  let lastError, time = 1
  let error = (time) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), time))

  const process = () => Promise.race([error(maxTime), run]).then(resolve).catch(e => {
    if (e?.message) lastError = e
    if (time++ <= retryTimes) {
      console.log('retry:', time)
      try {
        process()
      } catch (e) {
        reject(e)
      }
    } else {
      reject(lastError)
    }
  })
  process()
})

exports.createChunkStream = (url, chunkSize = 10 * 1024 * 1024, options = {}) => {

  let downloaded = 0
  let stream = createStream(options.highWaterMark)
  let willEnd = false

  let pos = options.start || 0
  let end = options.end || options.total || 0

  const next = async () => {
    let rangeEnd = pos + chunkSize
    if (!end || rangeEnd >= end) {
      rangeEnd = end
      willEnd = true
    }

    let headers = {
      range: `bytes=${pos}-${rangeEnd || ''}`,
      ...(options.headers || {})
    }

    let res = await retry(request.get(url, {
      headers,
      responseType: 'stream',
      retry: 0,
      timeout: 5000
    }), 3, 6000)

    const ondata = chunk => {
      downloaded += chunk.length;
      stream.emit('progress', downloaded);
    };

    res.data.on('data', ondata)
    res.data.on('error', (e) => {
      console.log(e)
    })
    res.data.on('end', () => {

      if (!willEnd) {
        pos = rangeEnd + 1
        next()
      }

    })
    // stream
    res.data.pipe(stream, { end: willEnd })
  }

  next()

  return stream
}

exports.createChunkWriteStream = function (url, chunkSize = 10 * 1024 * 1024, total, onChunk) {

  const stream = new PassThrough({
    highWaterMark: 512 * 1024,
  });

  let pos = 0

  let uploaded = 0, chunkUploaded = 0

  let exceed, uploadStream

  stream.on('data', (chunk) => {
    let willPause = false
    chunkUploaded += chunk.length
    if (chunkUploaded >= chunkSize) {
      exceed = chunk.slice(chunkSize)
      willPause = uploadStream.end(chunk.slice(0, chunkSize))
    } else {
      willPause = uploadStream.write(chunk.slice(0, chunkSize))
    }
    if (flag == false) {
      stream.pause()
    }
  })

  stream.on('end', () => {

  })

  const next = async () => {

    let rangeEnd = pos + chunkSize
    if (!end || rangeEnd >= end) {
      rangeEnd = end
      willEnd = true
    }

    uploadStream = new PassThrough()
    uploadStream.on('end', next)
    chunkUploaded = 0

    if (exceed) {
      uploadStream.write(exceed)
      exceed = null
    }

    let reqOptions = {
      url, headers: {}, method: 'put', contentType: "stream",
      body: uploadStream,
      responseType: 'text',
    }

    if (onChunk) {
      let res = await onChunk(pos, rangeEnd)
      reqOptions = { ...reqOptions, ...res }
    }

    request(reqOptions.url, reqOptions)

    stream.resume()
  }

  next()

  return stream

}