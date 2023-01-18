
import { defineComponent } from 'vue'
import { useApi, ReqResponse } from '@/hooks/useApi'
import { reactive, ref, Ref } from 'vue'
import SparkMD5 from 'spark-md5'
import useDisk from '../useDisk'
import { STATUS } from '../task'
import { message } from 'ant-design-vue'
import SHA1 from 'js-sha1'

const parseSize = (v: string) => {
  if (!v) return { type: undefined, size: 0 }

  let unitMap: Record<string, number> = { 'k': 1024, 'm': 1024 * 1024 }
  let [_, type, num, unit] = v.toLowerCase().match(/(md5|sha1)?\-?(\d+)(k|m)?/i) || []
  let size = num ? parseInt(num) : 0
  if (unit && unitMap[unit]) {
    size *= unitMap[unit]
  }
  return { type, size }
}
interface readChunkedOptions {
  onChunk(...rest: Array<any>): any
  onFinish(...rest: Array<any>): any
  chunkSize: number
}
function readChunked(file: File, { onChunk, onFinish, chunkSize }: readChunkedOptions) {
  const fileSize = file.size

  let offset = 0

  const reader = new FileReader()
  reader.onload = function () {
    if (reader.error) {
      console.log(reader.error)
      onFinish(reader.error || {})
      return
    }
    offset += (reader as any).result.byteLength
    // offset += (reader as any).result.length
    // return
    // callback for handling read chunk
    // TODO: handle errors
    onChunk(reader.result, offset, fileSize)

    if (offset >= fileSize) {
      onFinish(null)
      return
    } else {
      readNext()
    }
  }

  reader.onerror = function (err) {
    onFinish(err || {})
  }

  function readNext() {
    const fileSlice = file.slice(offset, offset + chunkSize)
    reader.readAsArrayBuffer(fileSlice)
  }
  readNext()
}

//3032ac4e71df951cccff8fdebad5266c
// single hash, head hash, chunk hash
export const getHash = async (file: File, hashtype: string) =>
  new Promise((resolve, reject) => {
    let parts = hashtype.split('_')
    let type = parts[0]
    let [headHash, partsHash] = parts.slice(1).map(parseSize)
    const hash = type == 'md5' ? new SparkMD5.ArrayBuffer() : type == 'sha1' ? SHA1.create() : null

    let defaultChunkSize = 50 * 1024 * 1024

    let ret: any = {
      head: '',
      parts: []
    } //Array<string> = []

    if (partsHash?.size) {
      defaultChunkSize = partsHash.size
    }

    const onEnd = () => resolve(ret)

    if (hash) {
      readChunked(file, {
        chunkSize: defaultChunkSize,
        onChunk(chunk: any, offset: number) {
          // content hash update
          if (type == 'md5') {
            hash.append(chunk)
          } else {
            hash.update(chunk)
          }

          // console.log(ret.head, headHash)
          // head hash
          if (headHash?.size && !ret.head) {
            let headHashType = headHash.type || type
            if (headHashType) {
              ret.head = SparkMD5.ArrayBuffer.hash(chunk.slice(0, headHash.size))
            } else if (headHashType == 'sha1') {
              ret.head = SHA1(chunk.slice(0, headHash.size))
            }
          }

          // parts hash
          if (partsHash?.size) {
            let partsHashType = partsHash.type || type

            if (partsHashType == 'md5') {
              ret.parts.push(SparkMD5.ArrayBuffer.hash(chunk))
            } else if (partsHashType == 'sha1') {
              ret.parts.push(SHA1(chunk))
            }
          }
        },
        onFinish(err: Error) {
          if (err) {
            reject(err)
          } else {
            // TODO: Handle errors
            // const final = hash.finalize()
            // resolve(final.toString(CryptoJS.enc.Hex))

            const final = type == 'md5' ? hash.end() : hash.hex()
            ret[type] = final
            onEnd()
          }
        }
      }
      )
    }
  })

type IUseUpload = {
  (): any
  instance?: any
}

interface IUseUploadResult {
  create(): Promise<void>
}

export const useUpload: IUseUpload = (): IUseUploadResult => {
  if (useUpload.instance) {
    return useUpload.instance
  }
  const { reload, current } = useDisk()

  const tasks: Ref<Array<any>> = ref([])

  // 1 正在生成任务(解析文件/读取文件 .etc)，2 解析文件过程发生错误, 3 正在复制，4 操作完成 且未发生错误,5. 操作完成 但发生部分完成
  const create = (files: Array<File>, hashType: string, dest: string, id: string, dir: boolean = false) => {
    const src = dir ? files[0].webkitRelativePath.split('/')[0] : files[0].name

    const size = files.reduce((t, c) => t + c.size, 0)

    const task: Record<string, any> = {
      id: '' + Date.now(),
      count: files.length,
      status: STATUS.INIT,
      completed: 0,
      currentCompleted: 0,
      current: '',
      readCompleted: 0,
      size,
      src,
      srcId: 'local:' + src,
      dest,
      destId: id,
      index: 0,
      speed: 0,
      hashType,
      files: files.map(i => ({
        name: i.name,
        size: i.size,
        dest: i.webkitRelativePath.split('/').slice(0, -1).filter(Boolean).join('/'),
        file: i
      })),
      error: []
    }

    tasks.value.push(task)
    createTransferTask(task.id)
  }


  const createTransferTask = async (taskId: string) => {
    let idx = tasks.value.findIndex((i: any) => i.id == taskId)
    const request = useApi()

    if (tasks.value[idx].status == STATUS.PROGRESS) {
      return
    }

    tasks.value[idx].status = STATUS.PROGRESS

    while (tasks.value[idx].index < tasks.value[idx].files.length) {
      let task = tasks.value[idx]
      let { index, files, hashType, destId } = task

      let { file, hash, dest, taskId } = files[index]

      if (!hash && hashType) {
        hash = await getHash(file, hashType)
        console.log('hash:', hash)
        files[index].hash = hash
      }

      const controller = new AbortController()

      let lastTime = 0, lastDataCount = 0
      let formData: Record<string, any> = {
        id: destId,
        size: file.size,
        name: file.name,
        hash,
        hash_type: hashType,
      }

      tasks.value[idx].cancel = () => controller.abort()
      tasks.value[idx].status = STATUS.PROGRESS
      try {

        //创建/查询任务
        let taskData = await request.fileCreateUpload({ ...formData, dest, task_id: taskId })

        //快速上传
        if (taskData.completed) {
          tasks.value[idx].completed += file.size
          tasks.value[idx].currentCompleted = 0
          tasks.value[idx].index = index + 1
          tasks.value[idx].current = file.name
          continue
        }

        //! 任务ID不存在，直接标记失败
        if (!taskData.taskId) {
          tasks.value[idx].status = STATUS.INIT_ERROR
          if (taskData.error) {
            tasks.value[idx].message = taskData.error.message
            files[index].message = taskData.error.message
          }

          console.log('here')
          throw taskData.error
        }

        //任务ID可能发生变化（如过期 导致原始的上传实例失效，后端会尝试生成新的上传实例，此时uploadId也会随之变化）
        tasks.value[idx].taskId = taskData.taskId
        files[index].taskId = taskData.taskId

        let uploadFile = file

        //续传
        if (taskData.start) {
          uploadFile = file.slice(taskData.start)
          tasks.value[idx].currentCompleted = taskData.start
        }

        tasks.value[idx].current = file.name

        let lastTime: number = Date.now(), lastLoaded = 0
        let res = await request.fileUpload({
          ...formData,
          taskId: files[index].taskId,
          create: 0,
          stream: uploadFile,
          slice_size: formData.size - taskData.start,
          customRequest: (params: any) => {
            params.timeout = 0
            params.onUploadProgress = (progressEvent: any) => {
              let ts = Date.now()
              if (ts - lastTime > 1000) {
                tasks.value[idx].speed = (progressEvent.loaded - lastLoaded) * 1000 / (ts - lastTime)
                lastLoaded = progressEvent.loaded
                lastTime = ts
                console.log(tasks.value[idx].speed)
              }
              tasks.value[idx].currentCompleted = taskData.start + progressEvent.loaded

            }
            params.signal = controller.signal

            //return upload(params)
          },
        })

        if (res.error) {
          console.log(res)

          //abord
          if (res.error.code == 'ERR_CANCELED') {
            return
          } else {
            tasks.value[idx].status = STATUS.INIT_ERROR
          }
        } else {
          tasks.value[idx].status = STATUS.SUCCESS
        }
      } catch (e) {
        console.log('error==>', e)
        if (!tasks.value[idx].error.includes(index)) {
          tasks.value[idx].error.push(index)
        }
      }

      tasks.value[idx].completed += file.size
      tasks.value[idx].currentCompleted = 0
      tasks.value[idx].index++
    }

    message.success(`${tasks.value[idx].src} 已完成`)

    //finish
    if (tasks.value[idx].index >= tasks.value[idx].files.length) {
      tasks.value[idx].status = tasks.value[idx].error.length > 0 ? (tasks.value[idx].error.length == tasks.value[idx].count ? STATUS.ERROR : STATUS.DONE_WITH_ERROR) : STATUS.SUCCESS

      // update page
      console.log(current?.path, tasks.value[idx])
      if (current?.path && current.path == tasks.value[idx].dest) {
        reload()
      }

      return
    }

  }

  const remove = async (task: any) => {
    let hit = tasks.value.find((i: any) => i.id == task.id)
    if (hit) {
      tasks.value.splice(hit, 1)
    }
  }

  const pause = async (task: any) => {
    const request = useApi()

    let idx = tasks.value.findIndex((i: any) => i.id == task.id)
    if (idx == -1) {
      message.error('没有此任务')
    } else {
      const res = await request.fileUploadCancel(tasks.value[idx].taskId)

      tasks.value[idx].cancel()
      tasks.value[idx].status = STATUS.PAUSE
    }
  }

  const resume = async (task: any) => {
    let hit = tasks.value.find((i: any) => i.id == task.id)
    if (!hit) {
      message.error('没有此任务')
    } else {
      createTransferTask(hit.id)
    }
  }
  useUpload.instance = {
    create,
    tasks,
    remove,
    resume,
    pause
  }
  return useUpload.instance
}


export const Upload = defineComponent({
  props: {
    type: String,
    disabled: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { slots }) {
    const file = ref()
    const { diskConfig, paths } = useDisk()
    const request = useApi()

    const { create } = useUpload()

    const onOpenFileDialog = () => {
      console.log('is open', props.disabled, file.value)
      if (props.disabled) {
        return
      }
      file.value?.click?.()
    }

    const onChange = async (e: any) => {
      let { uploadHash, id } = diskConfig.value
      let files = [].slice.call(e.target.files)
      let dest = '/' + [...paths.value].join('/')
      // console.log(uploadHash)
      if (uploadHash) {
        // let path = '/' + [...paths.value, file.name].join('/')
        // console.log(file, paths)
        await create(files, uploadHash, dest, id, props.type == 'dir')
      } else {
        await create(files, null, dest, id, props.type == 'dir')
      }

      //clear select
      if (file.value) {
        file.value.value = ''
      }
    }

    let inputProps: Record<string, any> = props.type == 'dir' ? { webkitdirectory: true, directory: true, multiple: true } : {}
    return () => <div onClick={onOpenFileDialog}>
      <input {...inputProps} type="file" onChange={onChange} ref={file} accept="" onClick={e => e.stopPropagation()} capture={true} style="display:none;" />
      {slots.default?.()}
    </div>

  }
})