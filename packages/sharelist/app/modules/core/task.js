
/**
 * type ITask = {
 *   total:number,
 *   success:number,
 *   error:number,
 *   totalSize:number,
 *   status: STATUS
 * } 
 */
const path = require('path')
const { PassThrough, pipeline } = require('stream')
const fs = require('fs')
const createDb = require('./db')
const { md5, isUrl } = require('./utils')

const createAsyncCtrl = (beforeReject) => {
  let error
  let controller = new AbortController()

  let promise = new Promise((_, reject) => {
    error = (e) => {
      controller.abort()
      reject(e)
    }
  })
  let run = (p) => Promise.race([p, promise])
  return { error, run, signal: controller.signal }
}

const STATUS = {
  INIT: 1, //1 正在生成任务(解析文件)
  INIT_ERROR: 2, //2 解析文件过程发生错误
  PROGRESS: 3, //3 正在复制
  SUCCESS: 4, //4 操作完成
  DONE_WITH_ERROR: 5,//5.操作完成 但发生部分完成
  ERROR: 6,//6 失败
  PAUSE: 7,//已暂停
}

const genKey = (input) => md5(input).substring(8, 24)

const parsePaths = v => v.replace(/(^\/|\/$)/g, '').split('/').map(decodeURIComponent).filter(Boolean)

const sleep = (t = 0) => new Promise((r) => { setTimeout(r, t) })

const statsStream = (stream, cb) => {

  let loaded = 0, lastTime = Date.now(), chunkloaded = 0
  stream.on('data', (chunk) => {
    loaded += chunk.length
    chunkloaded += chunk.length
    let timePass = Date.now() - lastTime
    if (timePass >= 1000) {
      cb(loaded, chunkloaded * 1000 / timePass)
      chunkloaded = 0
      lastTime = Date.now()
    }
  })

}

const ignoreStream = (readStream, length) => {
  let stream = new PassThrough()
  let count = 0

  const onData = (chunk) => {
    count += chunk.length
    if (count >= length) {
      readStream.off('data', onData)
      stream.write(chunk.slice(count - length))
      readStream.pipe(stream)
    }
  }
  readStream.on('data', onData)

  readStream.resume()

  return stream
}
exports.createTransfer = (cacheDir, driver, request) => {
  const TAG = 'transfer'

  const basePath = path.join(cacheDir, TAG)
  if (fs.existsSync(basePath) == false) {
    fs.mkdirSync(basePath)
  }

  const { data: tasksMap } = createDb(path.join(basePath, `list.json`), { autoSave: true, debug: false })

  const worker = {}

  //取得目标目录，没有则创建
  const changeDir = async (dest) => {
    let paths = dest.split('/'), nonExistDir = []
    let parent
    while (true) {
      try {
        parent = await driver.stat(paths)
        if (parent) {
          break;
        } else {
          nonExistDir.unshift(paths.pop())
        }
      } catch (e) {
        console.log('stat error', e)
        nonExistDir.unshift(paths.pop())
      }
    }

    for (let i = 0; i < nonExistDir.length; i++) {
      parent = await driver.mkdir(parent.id, nonExistDir[i])
    }

    return parent
  }

  const pickup = (file, parent) => {
    let r = { id: file.id, name: file.name, size: file.size, dest: parent }
    if (file.extra) {
      if (file.extra.md5) {
        // r.md5 = file.extra.md5
        r.hash = { md5: file.extra.md5 }
        // r.hash_type = 'md5'
      }
      else if (file.extra.sha1) {
        // r.sha1 = file.extra.sha1
        r.hash = { sha1: file.extra.sha1 }
        // r.hash_type = 'sha1'
      }
    }
    if (!r.size) r.lazy = true
    return r
  }

  const create = async (src, dest, idMode = false, { conflictBehavior = 1, threadNum = 1 } = {}) => {
    let srcPaths = [], destPaths = [], srcId, destId

    if (idMode) {
      srcId = src
      destId = dest
      srcPaths = (await driver.pwd(src)).map(i => i.name)
      destPaths = (await driver.pwd(dest)).map(i => i.name)
    } else {
      srcPaths = parsePaths(src)
      destPaths = parsePaths(dest)
    }
    console.log('move:', srcPaths, '==>', destPaths)

    const taskId = genKey(srcPaths.join('/') + '->' + destPaths.join('/'))

    //相同
    if (tasksMap[taskId]) {
      let task = tasksMap[taskId]
      // console.log('The same task exists.', task)

      //if (task.status == STATUS.SUCCESS) {
      //  delete tasksMap[taskId]
      //} else {
      throw { message: 'Task already exists / 存在相同的任务', code: 429 }
      //}
    }

    tasksMap[taskId] = {
      id: taskId,
      count: 0,
      status: STATUS.INIT,
      src: srcPaths.join('/'),
      srcId,
      dest: destPaths.join('/'),
      destId,
      size: 0,
      error: 0,
      success: 0,
      loaded: 0,
      currentLoaded: 0,
      speed: 0,
      index: 0,
      inited: false,
      currentDir: '',
      conflictBehavior,
      threadNum,
      retry: 0
    }

    createParseTask(taskId)
  }


  //读取目录
  const createParseTask = async (taskId) => {

    //当前任务的文件列表
    let { save: saveFiles } = createDb(path.join(basePath, `${taskId}.json`), { autoSave: false }, [])

    //任务元数据
    let { data: taskData } = createDb(path.join(basePath, `${taskId}_data.json`), { autoSave: true }, { error: [], retried: [] })

    let files = []

    let abortSignal = false

    let srcPaths = tasksMap[taskId].src.split('/').filter(Boolean)

    let srcId = tasksMap[taskId].srcId

    let destPaths = tasksMap[taskId].dest.split('/').filter(Boolean)

    worker[taskId] = {
      files,
      data: taskData,
      cancel: function cancel() {
        abortSignal = true
      }
    }

    //准备阶段，读取源目录信息
    try {
      // console.log('get', srcId, srcPaths)
      let res = await driver.get({ id: srcId, paths: srcPaths }, { enableCache: false, more: true })

      if (abortSignal) return
      if (res.type == 'file') {
        files.push(
          pickup(res, destPaths.join('/'))
        )
      } else {
        let dirs = [[res.id, [...destPaths, srcPaths.pop()].join('/')]]
        while (dirs.length) {
          let [id, destPath] = dirs.shift()

          let children = (await driver.list({ id })).files

          let subfiles = children.filter(i => i.type != 'folder').map((i) => pickup(i, destPath))

          if (subfiles) {
            files.push(
              ...subfiles
            )
          }

          dirs.push(...children.filter(i => i.type == 'folder').map(i => [i.id, destPath ? `${destPath}/${i.name}` : i.name]))

          if (abortSignal) {
            return
          }
        }
      }

      if (abortSignal) return

      let fileTask = files.filter(i => !!i.id)
      tasksMap[taskId].count = fileTask.length
      tasksMap[taskId].size = fileTask.reduce((t, c) => t + c.size, 0)
      tasksMap[taskId].inited = true
      //tasksMap[taskId].status = STATUS.PROGRESS

      //保存到文件
      saveFiles(files)

      createTransferTask(taskId)

    } catch (e) {
      console.trace(e)
      tasksMap[taskId].status = STATUS.INIT_ERROR
      tasksMap[taskId].message = e?.message
    }
  }


  const createTransferTask = async (taskId) => {
    let abortSignal = false
    let currentDirData

    const setState = (state) => {
      let { data } = worker[taskId]
      let { index, size: totalSize, count } = tasksMap[taskId]

      let { $stats, ...rest } = state
      let key = `${taskId}@${index}`

      if (Object.keys(rest).length) {
        data[key] = rest
      }
      // 单独处理状态报告
      if ($stats) {
        let { loaded, speed, total } = $stats
        tasksMap[taskId].currentLoaded = loaded
        tasksMap[taskId].progress = totalSize ? (loaded / totalSize) : ((index + loaded / total) / count)
        tasksMap[taskId].speed = speed
      }
    }

    const streamCreater = (id, ctrl, fileData) => async ({ start, end, state, supportStatsReport }) => {
      let { stream: readStream, enableRanges } = await driver.createReadStream(id, {
        start, end,
        signal: ctrl.signal,
      })

      //! 如果传入流 无法进行续传，则等待该流到达指定位置
      if (!enableRanges && start != 0) {
        readStream = ignoreStream(readStream, start)
      }

      // 默认通过传入流进行间接计算 状态。但：
      // 1. 当挂载源支持多线程时，应自行实现状态探针。
      if (!supportStatsReport) {
        statsStream(readStream, (loaded, speed) => {
          setState({ '$stats': { loaded, speed, total: fileData } })
        })
      }

      // work has been removed.
      if (!worker[taskId]) {
        return
      }

      readStream.once('error', ctrl.error)

      if (tasksMap[taskId] && start) {
        tasksMap[taskId].currentLoaded = start
      }

      if (state) setState(state)
      return readStream
    }


    const next = async () => {
      if (abortSignal) return

      const { files, data } = worker[taskId]

      let { index: taskIndex, conflictBehavior, retry, threadNum } = tasksMap[taskId]

      //finish
      if (taskIndex >= files.length || taskIndex == -1) {
        tasksMap[taskId].status = tasksMap[taskId].error > 0 ? (tasksMap[taskId].error == tasksMap[taskId].count ? STATUS.ERROR : STATUS.DONE_WITH_ERROR) : STATUS.SUCCESS
        return
      }

      console.log('currentIndex', taskIndex)

      let file = files[taskIndex]

      if (file.lazy) {
        let res = await driver.get({ id: file.id }, { enableCache: false, more: true })
        file = Object.assign({}, file, res)
      }

      let { id, name, size, dest, hash, hash_type } = file

      //执行进入目录
      if ((dest && dest != tasksMap[taskId].currentDir) || !currentDirData) {
        currentDirData = await changeDir(dest)
        tasksMap[taskId].currentDir = dest
      }
      //所有上传任务 都需要指明父目录
      if (!currentDirData?.id) return

      let key = `${taskId}@${taskIndex}`

      const ctrl = createAsyncCtrl()

      //当前任务的文件
      tasksMap[taskId].current = name

      worker[taskId].cancel = function cancel() {
        abortSignal = true

        ctrl.error({
          type: 'aborted'
        })
      }

      try {

        await ctrl.run(driver.upload(currentDirData.id, streamCreater(id, ctrl, file), {
          name, size, conflictBehavior, threadNum,

          hash: hash || {}, hash_type,
          signal: ctrl.signal,

          state: data[key],
          setState
        }))

        tasksMap[taskId].success++

      } catch (e) {
        console.log(e)
        // 用户主动 abort 导致的异常 不计入异常文件
        if (e.type == 'aborted') return

        //连接重置 可能是网络问题，而非 serverside 服务异常
        //if (e.type != 'ECONNRESET') {
        //tasksMap[taskId].uploadId = ''
        //}

        if (!data.error.includes(taskIndex)) {
          data.error.push(taskIndex)
          tasksMap[taskId].error++
        }

        tasksMap[taskId].message = e.message
      }

      if (abortSignal) return

      //计数
      tasksMap[taskId].loaded += size
      tasksMap[taskId].currentLoaded = 0

      // 如果retry 模式，则跳转到下一个error 部分
      if (tasksMap[taskId].retry) {
        let errIdx = data.retried.indexOf(taskIndex)
        if (errIdx >= 0) {
          tasksMap[taskId].index = data.retried[errIdx + 1] || -1
          data.retried.splice(errIdx, 1)
        } else {
          tasksMap[taskId].index = files.length
        }
      } else {
        tasksMap[taskId].index = taskIndex + 1
      }

      delete data[key]

      setTimeout(next, 0)
    }


    tasksMap[taskId].status = STATUS.PROGRESS

    if (abortSignal) return

    next()
  }


  const remove = (taskId) => {

    if (tasksMap[taskId]) {
      try {
        // stopStream
        worker[taskId]?.cancel?.()

        //remove upload session 
        const { index, destId } = tasksMap[taskId]
        const { data } = worker[taskId]

        let key = `${taskId}@${index}`
        console.log('clear session', destId, data[key])
        driver?.clearSession?.(destId, data[key])

        fs.rmSync(path.join(basePath, `${taskId}.json`), { force: false, recursive: true })
        fs.rmSync(path.join(basePath, `${taskId}_data.json`), { force: false, recursive: true })
      } catch (e) {

      }
      delete worker[taskId]
      delete tasksMap[taskId]
    } else {
      return { error: { message: 'task does not exist' } }
    }
  }

  /**
   * 暂停
   * @param {*} taskId 
   * @returns 
   */
  const pause = (taskId) => {
    if (!tasksMap[taskId]) {
      return { error: { message: 'task does not exist' } }
    }

    //初始化 和 移动状态时可用
    if (tasksMap[taskId].status != STATUS.PROGRESS && tasksMap[taskId].status != STATUS.INIT) {
      throw { message: 'No need to pause in this state' }
    }

    try {
      // stopStream
      worker[taskId]?.cancel?.(true)

    } catch (e) {
      console.log(e)
    }

    tasksMap[taskId].status = STATUS.PAUSE

  }

  /**
   * 启动/恢复
   * @param {*} taskId 
   * @returns 
   */
  const resume = async (taskId) => {
    if (!tasksMap[taskId]) {
      return { error: { message: 'task does not exist' } }
    }

    if (tasksMap[taskId].status == STATUS.PAUSE) {
      //未读取完成
      tasksMap[taskId].status = STATUS.INIT
      if (!tasksMap[taskId].inited) {
        createParseTask(taskId)
      } else {
        createTransferTask(taskId)
      }
    }
  }

  /**
   * 读取进度文件，并将所有任务置于暂停状态
   */
  const init = () => {
    for (let task of Object.values(tasksMap)) {
      if (task.status == STATUS.PROGRESS) {
        task.status = STATUS.PAUSE
      }
      let taskId = task.id
      let { data: files } = createDb(path.join(basePath, `${taskId}.json`), { autoSave: true }, [])

      tasksMap[taskId].currentDir = ''
      //任务错误文件
      let { data } = createDb(path.join(basePath, `${taskId}_data.json`), { autoSave: true }, { error: [], retried: [] })
      worker[taskId] = {
        files, data
      }
    }
  }

  const retry = (taskId) => {
    if (!tasksMap[taskId]) {
      throw { message: 'task does not exist' }
    }

    //重置files

    const { files, data } = worker[taskId]
    let successTotalSize = 0, successCount = 0
    for (let i = 0; i < files.length; i++) {
      let file = files[i]
      if (!data.error.includes(i)) {
        successCount++
        successTotalSize += file.size
      }
    }

    tasksMap[taskId].error = 0
    tasksMap[taskId].status = STATUS.PROGRESS
    tasksMap[taskId].currentDir = ''
    tasksMap[taskId].loaded = successTotalSize
    tasksMap[taskId].success = successCount
    tasksMap[taskId].index = data.error[0]
    tasksMap[taskId].retry = 1

    data.retried = [...data.error]
    data.error = []
    createTransferTask(taskId)

    return {}
  }

  const get = (taskId) => {
    if (!tasksMap[taskId]) return { error: { message: 'task does not exist' } }

    try {
      // stopStream
      let { ...ret } = tasksMap[taskId]
      let files = worker[taskId].files
      ret.error = worker[taskId].data.error
      ret.files = files
      return ret
    } catch (e) {
      console.log(e)
    }
  }

  const getWorkers = () => {
    return [...Object.values(tasksMap)].reverse()
  }

  init()

  return { get, create, remove, pause, resume, all: getWorkers, retry }
}