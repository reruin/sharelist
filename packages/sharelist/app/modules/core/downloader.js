
/**
 * type ITask = {
 *   total:number,
 *   success:number,
 *   error:number,
 *   totalSize:number,
 *   status: STATUS
 * } 
 */
const createDb = require('./db')
const path = require('path')
const { md5 } = require('./utils')
const { PassThrough, pipeline } = require('stream')
const fs = require('fs')

const createAsyncCtrl = () => {
  let run
  let promise = new Promise((_, reject) => {
    run = reject
  })
  let safe = (p) => Promise.race([p, promise])
  return { throw: run, run: safe }
}

const TAG = 'transfer'

const STATUS = {
  INIT: 1, //1 正在生成任务(解析文件)
  INIT_ERROR: 2, //2 解析文件过程发生错误
  PROGRESS: 3, //3 正在复制
  SUCCESS: 4, //4 操作完成
  DONE_WITH_ERROR: 5,//5.操作完成 但发生部分完成
  ERROR: 6,//6 失败
  PAUSE: 7,//已暂停
}

const genKey = (input) => md5(input)

const parsePaths = v => v.replace(/(^\/|\/$)/g, '').split('/').map(decodeURIComponent).filter(Boolean)

const sleep = (t = 0) => new Promise((r) => { setTimeout(r, t) })

const createStatsStream = (cb) => {
  let stream = new PassThrough()
  let completed = 0, lastTime = Date.now(), chunkCompleted = 0
  stream.on('data', (chunk) => {
    completed += chunk.length
    chunkCompleted += chunk.length
    let timePass = Date.now() - lastTime
    if (timePass >= 1000) {
      cb(completed, chunkCompleted * 1000 / timePass)
      chunkCompleted = 0
      lastTime = Date.now()
    }
  })

  return stream
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

  return stream
}

module.exports = (cacheDir, driver, request) => {
  const basePath = path.join(cacheDir, TAG)
  if (fs.existsSync(basePath) == false) {
    fs.mkdirSync(basePath)
  }

  const { data: taskData } = createDb(path.join(basePath, `list.json`), { autoSave: true, debug: false })

  const worker = {}

  //取得目标目录，没有则创建
  const changeDir = async (dest) => {
    let paths = dest.split('/'), nonExistDir = []
    let parent
    while (true) {
      try {
        parent = await driver.stat(paths)
        console.log('has', parent)
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

    console.log(nonExistDir, 'nonExistDir')
    for (let i = 0; i < nonExistDir.length; i++) {
      parent = await driver.mkdir(parent.id, nonExistDir[i])
    }

    return parent
  }

  const pickup = (file, parent) => {
    let r = { id: file.id, name: file.name, size: file.size, dest: parent }
    if (file.extra) {
      if (file.extra.md5) r.md5 = file.extra.md5
      if (file.extra.sha1) r.sha1 = file.extra.sha1
    }
    return r
  }

  // get base meta
  const createRemote = async (url, dest, idMode = false) => {
    const taskId = genKey(url + '->' + destPaths.join('/'))
    if (idMode) {
      destPaths = (await driver.pwd(dest)).map(i => i.name)
    } else {
      destPaths = parsePaths(dest)
    }

    taskData[taskId] = {
      id: taskId,
      count: 0,
      status: STATUS.INIT,
      src: srcPaths.join('/'),
      srcId,
      dest: destPaths.join('/'),
      size: 0,
      error: 0,
      success: 0,
      completed: 0,
      currentCompleted: 0,
      speed: 0,
      index: 0,
      inited: false,
      currentDir: ''
    }
  }

  const create = async (src, dest, idMode = false) => {
    let srcPaths = [], destPaths = [], srcId

    if (idMode) {
      srcId = src
      console.log('start get path from id')
      srcPaths = (await driver.pwd(src)).map(i => i.name)
      console.log('end get path from id', srcPaths)

      destPaths = (await driver.pwd(dest)).map(i => i.name)
    } else {
      srcPaths = parsePaths(src)
      destPaths = parsePaths(dest)
    }
    console.log(srcPaths, '==>', destPaths)

    const taskId = genKey(srcPaths.join('/') + '->' + destPaths.join('/'))

    //相同
    if (taskData[taskId]) {
      let task = taskData[taskId]
      if (task.status == STATUS.SUCCESS) {
        delete taskData[taskId]
      } else {
        throw { message: 'The same task exists.', code: 429 }
      }
    }

    taskData[taskId] = {
      id: taskId,
      count: 0,
      status: STATUS.INIT,
      src: srcPaths.join('/'),
      srcId,
      dest: destPaths.join('/'),
      size: 0,
      error: 0,
      success: 0,
      completed: 0,
      currentCompleted: 0,
      speed: 0,
      index: 0,
      inited: false,
      currentDir: ''
    }

    createParseTask(taskId)
  }


  //读取目录
  const createParseTask = async (taskId) => {

    //创建任务日志
    let { save: saveTasks } = createDb(path.join(basePath, `${taskId}.json`), { autoSave: false }, [])

    //任务错误日志
    let { data: error } = createDb(path.join(basePath, `${taskId}_error.json`), { autoSave: true }, [])

    let subtasks = []

    let abortSignal = false

    let srcPaths = taskData[taskId].src.split('/').filter(Boolean)

    let srcId = taskData[taskId].srcId

    let destPaths = taskData[taskId].dest.split('/').filter(Boolean)

    worker[taskId] = {
      tasks: [],
      error,
      cancel: function cancel() {
        abortSignal = true
      }
    }

    //准备阶段，读取源目录信息
    try {
      let res = await driver.get({ id: srcId, paths: srcPaths })

      if (abortSignal) return

      if (res.type == 'file') {
        subtasks.push(
          // { cd: destPaths.join('/') },
          pickup(res, destPaths.join('/'))
        )
      } else {
        let dirs = [[res.id, [...destPaths, srcPaths.pop()].join('/')]]
        while (dirs.length) {
          let [id, destPath] = dirs.shift()

          let children = (await driver.list({ id })).files

          let subfiles = children.filter(i => i.type != 'folder').map((i) => pickup(i, destPath))

          if (subfiles) {
            subtasks.push(
              // { cd: destPath },
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

      let fileTask = subtasks.filter(i => !!i.id)
      taskData[taskId].count = fileTask.length
      taskData[taskId].size = fileTask.reduce((t, c) => t + c.size, 0)
      taskData[taskId].inited = true
      //taskData[taskId].status = STATUS.PROGRESS

      //保存到文件
      saveTasks(subtasks)

      worker[taskId].tasks = subtasks

      createTransferTask(taskId)

    } catch (e) {
      console.trace(e)
      taskData[taskId].status = STATUS.INIT_ERROR
      taskData[taskId].message = e?.message
    }
  }


  const createTransferTask = async (taskId) => {
    let abortSignal = false
    let currentDirData

    const next = async () => {

      const tasks = worker[taskId].tasks

      let { uploadId, index: taskIndex } = taskData[taskId]
      //finish
      if (taskIndex >= tasks.length) {
        taskData[taskId].status = taskData[taskId].error > 0 ? (taskData[taskId].error == taskData[taskId].count ? STATUS.ERROR : STATUS.DONE_WITH_ERROR) : STATUS.SUCCESS
        return
      }

      let controller = new AbortController()
      let { id, name, size, md5, sha1, dest } = tasks[taskIndex]

      //执行进入目录
      if ((dest && dest != taskData[taskId].currentDir) || !currentDirData) {
        currentDirData = await changeDir(dest)
        console.log(currentDirData)
        taskData[taskId].currentDir = dest
      }

      //所有上传任务 都需要指明父目录
      if (!currentDirData?.id) return

      try {
        //当前任务的文件
        taskData[taskId].current = name

        const { done, uploadId: newUploadId, start, completed } = await driver.upload(currentDirData.id, null, {
          manual: true,
          name, size, md5, sha1, uploadId,
          signal: controller.signal
        })

        // fast upload
        if (completed) {
          taskData[taskId].completed += size
          taskData[taskId].currentCompleted = 0
          taskData[taskId].index = taskIndex + 1

          if (abortSignal) return
          setTimeout(next, 0)
          return
        }

        console.log('newUploadId', newUploadId, start)

        taskData[taskId].uploadId = newUploadId
        taskData[taskId].currentCompleted = start

        //失效, drive plugin 对于无效的uploadId 可自主生成新的upload 并返回
        if (!newUploadId) {
          throw { message: 'uploadId is expired.' }
        }

        let { stream: readStream } = await driver.createReadStream(id, { start })

        readStream.pause()

        //创建一个可计数状态流
        const stream = createStatsStream((currentCompleted, speed) => {
          if (taskData[taskId]) {
            taskData[taskId].currentCompleted = start + currentCompleted
            taskData[taskId].speed = speed
          } else {
            console.log('destroy')
          }
        })

        const ctrl = createAsyncCtrl()

        worker[taskId].cancel = function cancel() {
          abortSignal = true
          controller.abort()
          ctrl.throw({
            type: 'aborted'
          })
          readStream.destroy()
        }

        readStream.once('error', (e) => {
          controller.abort()
          ctrl.throw(e)
        })

        readStream.pipe(stream)

        await ctrl.run(done(stream, (uploadId) => {
          if (taskData[taskId]) {
            taskData[taskId].uploadId = uploadId
          }
        }))

        //成功计数
        taskData[taskId].success++
      } catch (e) {
        console.log('transfer occur error', e, e.type)

        // 用户主动 abort 导致的异常 不计入异常文件
        if (e.type == 'aborted') return

        taskData[taskId].uploadId = ''
        if (!worker[taskId].error.includes(taskIndex)) {
          worker[taskId].error.push(taskIndex)
          taskData[taskId].error++
        }

        taskData[taskId].message = e.message
      }

      taskData[taskId].completed += size
      taskData[taskId].currentCompleted = 0
      taskData[taskId].index = taskIndex + 1

      if (abortSignal) return
      setTimeout(next, 0)
    }

    taskData[taskId].status = STATUS.PROGRESS

    if (abortSignal) return

    next()
  }


  const remove = (taskId) => {

    if (taskData[taskId]) {
      try {
        // stopStream
        worker[taskId]?.cancel?.()

        fs.rmSync(path.join(basePath, `${taskId}.json`), { force: false, recursive: true })
        fs.rmSync(path.join(basePath, `${taskId}_error.json`), { force: false, recursive: true })
      } catch (e) {

      }
      delete worker[taskId]
      delete taskData[taskId]
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
    if (!taskData[taskId]) {
      return { error: { message: 'task does not exist' } }
    }

    //初始化 和 移动状态时可用
    if (taskData[taskId].status != STATUS.PROGRESS && taskData[taskId].status != STATUS.INIT) {
      throw { message: 'No need to pause in this state' }
    }

    try {
      console.log(worker[taskId]?.cancel)
      // stopStream
      worker[taskId]?.cancel?.(true)
      //源目录读取状态时，取消读取

    } catch (e) {

    }
    taskData[taskId].status = STATUS.PAUSE

  }

  /**
   * 启动/恢复
   * @param {*} taskId 
   * @returns 
   */
  const resume = async (taskId) => {
    if (!taskData[taskId]) {
      return { error: { message: 'task does not exist' } }
    }

    if (taskData[taskId].status == STATUS.PAUSE) {
      //未读取完成
      if (!taskData[taskId].inited) {
        console.log('read')
        createReadTask(taskId)
      } else {
        createTransferTask(taskId)
      }
    }
  }

  /**
   * 读取进度文件，并将所有任务置于暂停状态
   */
  const init = () => {
    for (let task of Object.values(taskData)) {
      if (task.status == STATUS.PROGRESS) {
        task.status = STATUS.PAUSE
      }
      let taskId = task.id
      let { data: tasks } = createDb(path.join(basePath, `${taskId}.json`), { autoSave: true }, [])

      taskData[taskId].currentDir = ''
      //任务错误文件
      let { data: taskErrorStore } = createDb(path.join(basePath, `${taskId}_error.json`), { autoSave: true }, [])
      worker[taskId] = {
        tasks, error: taskErrorStore
      }
    }
  }

  const retry = (taskId) => {
    if (!taskData[taskId]) {
      throw { message: 'task does not exist' }
    }

    //重置files
    const { tasks, error } = worker[taskId]
    const newTasks = []
    let successTotalSize = 0, successCount = 0
    for (let i = 0; i < tasks.length; i++) {
      let task = tasks[i]
      if (error.includes(i)) {
        newTasks.push(task)
      } else {
        successCount++
        successTotalSize += task.size
      }
    }
    taskData[taskId].error = 0
    taskData[taskId].status = STATUS.PROGRESS
    taskData[taskId].currentDir = ''
    taskData[taskId].completed = successTotalSize
    taskData[taskId].success = successCount
    taskData[taskId].index = error[0]

    worker[taskId].tasks.splice(0, tasks.length, ...newTasks)
    worker[taskId].error.splice(0, error.length)

    createTransferTask(taskId)

    return {}
  }

  const get = (taskId) => {
    if (!taskData[taskId]) return { error: { message: 'task does not exist' } }

    try {
      // stopStream
      let { ...ret } = taskData[taskId]
      let files = worker[taskId].tasks
      if (ret.error > 0) {
        ret.error = worker[taskId].error.map(i => files[i])
      }
      return ret
    } catch (e) {
      console.log(e)
    }
  }

  const getWorkers = () => {
    return [...Object.values(taskData)].reverse()
  }

  init()

  return { get, create, remove, pause, resume, all: getWorkers, retry }
}