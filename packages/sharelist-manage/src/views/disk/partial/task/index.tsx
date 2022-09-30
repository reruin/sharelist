import { defineComponent, onUnmounted } from "vue"
import { useApi } from '@/hooks/useApi'
import { useRequest } from '@/hooks/useRequest'
import { List, Badge, message, Tabs, Modal, Spin, Alert, Button } from 'ant-design-vue'
import { CloudSyncOutlined, FileSyncOutlined, DeleteOutlined, InfoCircleOutlined, PauseOutlined, ReloadOutlined, DoubleRightOutlined, CloseOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import useDisk from '../useDisk'
import { byte, formatFile } from '@/utils/format'
import { useUpload } from '../upload'
import './index.less'
import { Meta, MetaLite } from '../meta'

export enum STATUS {
  INIT = 1, //1 正在生成任务(解析文件)
  INIT_ERROR = 2, //2 解析文件过程发生错误
  PROGRESS = 3, //3 正在复制
  SUCCESS = 4, //4 操作完成
  DONE_WITH_ERROR = 5,//5.操作完成 但发生部分完成
  ERROR = 6,//6 失败
  PAUSE = 7,//已暂停
}

type ITask = {
  src: string
  dest: string
  id: string
  // 1 正在生成任务(解析文件)，2 解析文件过程发生错误, 3 正在复制，4 操作完成 且未发生错误,5. 操作完成 但发生部分完成 
  status: STATUS
  index: number,
  current: string
  count: number
  size: number
  currentCompleted: number
  completed: number
  message?: string
  readCompleted?: number,
  speed: number,
  error?: Array<any>,
  [key: string]: any
}

type TaskSet = {
  transfer: Array<ITask>,
  download: Array<ITask>,
}

export default defineComponent({
  setup(props, ctx) {
    let request = useApi()
    const { setPath } = useDisk()
    const { tasks: uploadTasks, remove: removeUpload, pause: pauseUpload, resume: resumeUpload } = useUpload()

    const { data, runAsync, loading, cancel } = useRequest<TaskSet>(async () => {
      let res = await request.tasks()
      return res
    }, {
      pollingInterval: 1000,
      immediate: true,
      loadingDelay: 1000,
      pollingWhenHidden: false
    })

    const navSrc = (i: ITask) => {
      if (!i.srcId.startsWith('http')) {
        // it's a file
        if (i.count == 1) {
          setPath({ path: '/' + i.src.split('/').slice(0, -1).join('/') })
        } else {
          setPath({ path: '/' + i.src })
        }
      }
    }

    const navDest = (i: ITask) => {
      setPath({ path: '/' + i.dest })
    }

    const onResume = async (i: ITask) => {
      let res = await request.resumeTask(i.id)
      if (res.error) {
        message.error(res.error.message)
      } else {
        message.success('操作成功')
      }
    }

    const onPause = async (i: ITask) => {
      let res = await request.pauseTask(i.id)
      if (res.error) {
        message.error(res.error.message)
      } else {
        message.success('操作成功')
      }
    }

    const retry = async (taskId: string, modal: any) => {
      let res = await request.retryTask(taskId)
      if (res.error) {
        message.error(res.error.message)
      } else {
        message.success('操作成功')
        modal.destroy()
      }
    }

    const onQuery = async (i: ITask) => {
      let res = await request.task(i.id)
      if (res.error && !res.id) {
        message.error(res.error.message)
      } else {
        let files = res.files || [], error = res.error || [], index = res.index
        // 0 waiting 1 progress 2 success 3 fail
        files.forEach((i: IFile, idx: number) => {
          if (error.includes(idx)) {
            i.status = 3
          } else {
            i.status = idx < index ? 2 : idx > index ? 0 : 1
          }
        })
        useShowFiles(files, i.id, '以下文件移动失败', retry)
      }
    }

    const onDownloadResume = async (i: ITask) => {
      let res = await request.resumeDownload(i.id)
      if (res.error) {
        message.error(res.error.message)
      } else {
        message.success('操作成功')
      }
    }

    const onDownloadPause = async (i: ITask) => {
      console.log('pause', i.id)
      let res = await request.pauseDownload(i.id)
      if (res.error) {
        message.error(res.error.message)
      } else {
        message.success('操作成功')
      }
    }

    const useShowFiles = (files: Array<any>, taskId: string, tips: string, retry?: any) => {
      let data = files.map((i: IFile) => {
        i.name = (i.dest ? `${i.dest}/` : '') + i.name
        i.type = 'file'
        i.ext = i.name.split('.').pop()
        formatFile(i)
        return i
      })
      const modal = Modal.confirm({
        class: 'pure-modal pure-modal-hide-footer',
        width: '500px',
        closable: true,
        title: () => <div>任务详情</div>,
        content: (
          <div>
            <div class="modal">
              <div class="modal-body">
                <div class="task-error">
                  {
                    data.map(i => <MetaLite class="error-item" data={i} />)
                  }
                </div>
              </div>
              {
                retry ? <div class="modal-footer">
                  <Button type="primary" onClick={() => retry(taskId, modal)}>重试</Button>
                </div> : null
              }

            </div>
          </div>
        ),
      })
    }

    const queryUpload = async (i: ITask) => {
      useShowFiles(i.files.filter((i: IFile) => i.message), i.id, '以下文件上传失败')
    }

    onUnmounted(() => {
      cancel()
    })

    let { loading: removeLoading, run: remove } = useRequest(async (task: ITask) => {
      let res = await request.removeTask(task.id)
      if (res.error) {
        message.error(res.error.message)
      } else {
        await runAsync()
      }
    })

    let { loading: removeDownloadLoading, run: removeDownloadTask } = useRequest(async (task: ITask) => {
      let res = await request.removeDownloadTask(task.id)
      if (res.error) {
        message.error(res.error.message)
      } else {
        await runAsync()
      }
    })
    //<Progress size="small" percent={Math.floor(100 * (i.completed + i.currentCompleted) / i.size)} />

    const createTitle = (i: ITask, mid: string) => {
      let src = i.src.split('/').pop()
      let dest = i.dest.split('/').pop()
      let attrs: Record<string, any> = {}
      if (i.srcId.startsWith('http')) {
        attrs.href = i.srcId
        attrs.target = '_blank'
      }
      return <div>
        <div class="item__title">
          <a onClick={() => navSrc(i)} class="ellipsis" style="width:38%" title={src} {...attrs}>{src}</a>
          <span class="item__title-link" style="margin:0 5px;">{mid}</span>
          <a onClick={() => navDest(i)} class="ellipsis" style="width:38%" title={dest}>{dest}</a>
        </div>
        <div class="item-meta-description">
          {
            i.status == STATUS.INIT ?
              `正在创建中${i.readCompleted ? ('已读取' + Math.floor(100 * (i.readCompleted || 0) / i.size) + '%') : ''}`
              : (i.status == STATUS.INIT_ERROR || i.status == STATUS.ERROR) ? `失败${i.message ? (':' + i.message) : ''}`
                : i.status == STATUS.SUCCESS ? <div class="flex"><span>{byte(i.completed)}</span><span class="item__dot"></span>已完成</div> : i.status == STATUS.DONE_WITH_ERROR ? '已完成 存在部分错误'
                  : <div class="flex"><span>{byte(i.completed + i.currentCompleted, 2)}/{byte(i.size, 2)}</span><span class="item__dot"></span><span>{i.status == STATUS.PAUSE ? '已暂停' : `${byte(i.speed)}/S`}</span></div>
          }
        </div>
        {
          i.status == STATUS.PROGRESS && i.count > 1 ? <div class="item-meta-description ellipsis">
            当前第 {`${i.index + 1} / ${i.count}`} 项 {i.current}
          </div> : null
        }
        {/* <div style="flex:0 0 auto;margin-left:6px;">共 {i.count} 项</div> */}
      </div>
    }

    const renderItem = ({ item: i, index }: { item: ITask, index: number }) => <div class="item">
      {
        (i.status == STATUS.PROGRESS || i.status == STATUS.PAUSE) ? <div class="item__progress" style={{ width: `${Math.floor(100 * (i.completed + i.currentCompleted) / i.size)}%` }}></div> : null
      }
      <div class="item__head"><Badge status={(i.status == STATUS.INIT || i.status == STATUS.PROGRESS) ? 'processing' : i.status == STATUS.SUCCESS ? 'success' : i.status == STATUS.ERROR ? 'error' : i.status == STATUS.DONE_WITH_ERROR ? 'warning' : 'default'} /></div>
      <div class="item__body">{createTitle(i, '迁移至')}</div>
      <div class="item__foot">
        <div class="action">
          <span>{
            i.status == STATUS.PAUSE ? <ReloadOutlined onClick={() => onResume(i)} style={{ fontSize: '12px' }} /> :
              i.status == STATUS.PROGRESS ? <PauseOutlined onClick={() => onPause(i)} style={{ fontSize: '12px' }} /> : null}
          </span>
          {
            i.status != STATUS.PROGRESS ? <span style="margin-left:5px;" onClick={() => onQuery(i)}><InfoCircleOutlined style={{ fontSize: '12px' }} /></span> : null
          }
          <span style="margin-left:5px;" onClick={() => remove(i)}><CloseOutlined style={{ fontSize: '12px' }} /></span>
        </div>
      </div>
    </div>

    const renderUploadItem = ({ item: i, index }: { item: ITask, index: number }) => <div class="item">
      {
        i.status == 3 ? <div class="item__progress" style={{ width: `${Math.floor(100 * (i.completed + i.currentCompleted) / i.size)}%` }}></div> : null
      }
      <div class="item__head"><Badge status={(i.status == STATUS.INIT || i.status == STATUS.PROGRESS) ? 'processing' : i.status == STATUS.SUCCESS ? 'success' : i.status == STATUS.ERROR ? 'error' : i.status == STATUS.DONE_WITH_ERROR ? 'warning' : 'default'} /></div>
      <div class="item__body">{createTitle(i, '上传至')}</div>
      <div class="item__foot">
        <div class="action">
          <span>{
            i.status == STATUS.PAUSE ? <ReloadOutlined onClick={() => resumeUpload(i)} style={{ fontSize: '12px' }} /> :
              i.status == STATUS.PROGRESS ? <PauseOutlined onClick={() => pauseUpload(i)} style={{ fontSize: '12px' }} /> :
                (i.status == STATUS.ERROR || i.status == STATUS.DONE_WITH_ERROR) ? <InfoCircleOutlined onClick={() => queryUpload(i)} style={{ fontSize: '12px' }} /> : null}
          </span>
          <span style="margin-left:5px;" onClick={() => removeUpload(i)}><CloseOutlined style={{ fontSize: '12px' }} /></span>
        </div>
      </div>
    </div>

    const renderDownloadItem = ({ item: i, index }: { item: ITask, index: number }) => <div class="item">
      {
        (i.status == STATUS.PROGRESS || i.status == STATUS.PAUSE) ? <div class="item__progress" style={{ width: `${Math.floor(100 * (i.completed + i.currentCompleted) / i.size)}%` }}></div> : null
      }
      <div class="item__head"><Badge status={(i.status == STATUS.INIT || i.status == STATUS.PROGRESS) ? 'processing' : i.status == STATUS.SUCCESS ? 'success' : i.status == STATUS.ERROR ? 'error' : i.status == STATUS.DONE_WITH_ERROR ? 'warning' : 'default'} /></div>
      <div class="item__body">{createTitle(i, '迁移至')}</div>
      <div class="item__foot">
        <div class="action">
          <span>{
            i.status == STATUS.PAUSE ? <ReloadOutlined onClick={() => onDownloadResume(i)} style={{ fontSize: '12px' }} /> :
              i.status == STATUS.PROGRESS ? <PauseOutlined onClick={() => onDownloadPause(i)} style={{ fontSize: '12px' }} /> :
                (i.status == STATUS.ERROR || i.status == STATUS.DONE_WITH_ERROR) ? <ReloadOutlined onClick={() => onDownloadResume(i)} style={{ fontSize: '12px' }} /> : null}
          </span>
          <span style="margin-left:5px;" onClick={() => removeDownloadTask(i)}><CloseOutlined style={{ fontSize: '12px' }} /></span>
        </div>
      </div>
    </div>

    return () => <div class="task" onClick={e => e.stopPropagation()}>
      <Tabs centered>
        <Tabs.TabPane key="move" v-slots={{ tab: () => <div><CloudSyncOutlined />跨盘迁移</div> }}>
          <Spin spinning={loading.value || removeLoading.value}>
            <List class="task-list" dataSource={data?.value?.transfer} renderItem={renderItem}></List>
          </Spin>
        </Tabs.TabPane>
        <Tabs.TabPane key="download" v-slots={{ tab: () => <div><DownloadOutlined />离线下载</div> }}>
          <Spin spinning={loading.value || removeDownloadLoading.value}>
            <List class="task-list" dataSource={data?.value?.download} renderItem={renderDownloadItem}></List>
          </Spin>

        </Tabs.TabPane>
        <Tabs.TabPane key="upload" v-slots={{ tab: () => <div><FileSyncOutlined />文件上传</div> }}>
          <List class="task-list" dataSource={uploadTasks.value} renderItem={renderUploadItem}></List>
        </Tabs.TabPane>
      </Tabs>

    </div>
  }
})
