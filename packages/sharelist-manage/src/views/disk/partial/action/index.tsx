import { defineComponent, withDirectives, ref, getCurrentInstance, Ref } from "vue";
import { Input, Modal, message, Alert, Checkbox, RadioGroup, Radio } from 'ant-design-vue'
import useDisk from '../useDisk'
import { EditOutlined, ScissorOutlined, CloudDownloadOutlined, CloudUploadOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { useApi } from "@/hooks/useApi";
import { Meta, Tree } from '../meta'
import { useApiConfirm } from '@/hooks/useConfirm'
import { byte, getFileType, time } from '@/utils/format'
import { useUpload } from '../upload'
import Modifier from '../drive-modifier'
import { useSetting } from '@/hooks/useSetting'
import './index.less'
import { useFocus } from '@/hooks/useDirective'

// import { IUseSettingResult } from '../useDisk'
import { modal as T } from '@/components/modal'

interface IFileError extends IFile {
  errorMessage?: string
}

const FileErrorList = defineComponent({
  props: {
    files: Array
  },
  emits: ['change'],
  setup(props, { emit }) {
    let unchecked: Ref<Array<boolean> | any> = ref(props.files?.map(i => true))

    const toggle = (idx: number) => {
      unchecked.value[idx] = !unchecked.value[idx]
      emit('change', unchecked.value.reduce((t: Array<number>, c: boolean, idx: number) => c ? t.concat(idx) : t, []))
    }
    return () => <div>
      <div class="modal">
        <div class="modal__body" style="max-height:40vh;overflow-y:auto;">
          {
            props.files?.map((i: any, idx) => <div onClick={() => toggle(idx)} class="flex flex--between file-item"><Meta style="padding:8px;" errorMode={true} data={i as unknown as IFile}></Meta><Checkbox checked={!!unchecked.value[idx]} /></div>)
          }
        </div>
      </div>
    </div>
  }
})

const FileSelect = defineComponent({
  props: {
    files: Array
  },
  emits: ['change'],
  setup(props, { emit }) {
    let unchecked: Ref<Array<boolean> | any> = ref(props.files?.map(i => true))

    const toggle = (idx: number) => {
      unchecked.value[idx] = !unchecked.value[idx]
      emit('change', unchecked.value.reduce((t: Array<number>, c: boolean, idx: number) => c ? t.concat(idx) : t, []))
    }
    return () => <div>
      <div class="modal">
        <div class="modal__body" style="max-height:40vh;overflow-y:auto;">
          {
            props.files?.map((i: any, idx) => <div onClick={() => toggle(idx)} class="flex flex--between file-item"><Meta style="padding:8px;" data={i as unknown as IFile}></Meta><Checkbox checked={!!unchecked.value[idx]} /></div>)
          }
        </div>
      </div>
    </div>
  }
})

export const useActions = (diskIntance: any) => {

  let { mutate, setAuth, current, setPath } = diskIntance

  const appContext = getCurrentInstance()?.appContext;

  let request = useApi()
  const { setConfig, clearCache, config } = useSetting()

  const rename = (i: IFile) => {
    let name = i.name

    const onChange = (e: any) => {
      name = e.target.value
    }

    const onSave = async () => {
      if (name != i.name) {
        let res = await request.fileUpdate({ id: i.id, name })
        // console.log(res)
        if (res.error) {
          message.error(res.error.message)
          throw new Error()
        } else {
          i.name = name
          mutate(i)
          modal.destroy()
        }
      }
    }

    const modal = Modal.confirm({
      class: 'pure-modal',
      width: '500px',
      closable: true,
      appContext,
      autoFocusButton: null,
      title: <div><EditOutlined style={{ fontSize: '18px', marginRight: '8px' }} />重命名</div>,
      content: () => (
        <div>
          <Meta style="margin:16px 0;" data={i} />
          {useFocus(<Input class="sl-input" style="padding:1em;margin-top:16px;" defaultValue={name} onChange={onChange} />, true)}
        </div>
      ),
      onOk: onSave,
    })
  }

  const move = (files: IFile | Array<IFile>) => {
    let dest: String

    if (!Array.isArray(files)) {
      files = [files]
    }

    // 排除 当前目录
    // 排除 所有子目录
    let excludePath = [
      diskIntance.current.path,
      ...files.filter((i: IFile) => i.type == 'folder').map(i => diskIntance.current.path + '/' + i.name)
    ]

    let diskRootPath = '/' + diskIntance.current.path.split('/')[1]


    let isTransfer = ref(false)

    const onSelect = (e: IFile) => {
      dest = e.id
      if (!e.path.startsWith(diskRootPath)) {
        isTransfer.value = true
        console.log('WARNNING')
      } else {
        isTransfer.value = false
      }
    }
    const count = files.length
    const isSingleTask = count == 1
    const error: Array<any> = []
    const current = ref(0)
    const cancelFlag = ref(false)
    const key = '' + Math.random()
    const execMove = async () => {

      message.loading({ content: `正在${isTransfer.value ? '创建迁移任务' : '移动'}`, key, duration: 0 });

      for (let i of files as Array<IFile>) {
        if (cancelFlag.value) return
        message.loading({ content: `[${current.value + 1}/${count}]` + '正在移动:' + i.name, key, duration: 0 });

        let res = await request.fileUpdate({ id: i.id, dest })
        if (res.error) {
          i.error = res.error.message
          error.push(i.id)
        } else {
          if (!isTransfer.value) mutate(i, true)
        }
        current.value++
      }

      let errorFiles = files.filter((i: IFile) => error.includes(i.id))

      if (errorFiles.length) {
        if (isSingleTask) {
          message.error({ content: (files as Array<IFile>)[0].error, key, duration: 1 });
        } else {
          message.success({ content: '操作完成', key, duration: 0.01 });
          errorModal(errorFiles)
        }

      } else {
        message.success({ content: isTransfer.value ? '迁移任务创建成功' : '操作完成', key, duration: 1 });
      }
    }

    const errorModal = (errorFiles: Array<IFile>) => {
      let retryList: Array<number> = []
      Modal.confirm({
        class: 'pure-modal',
        width: '500px',
        closable: true,
        title: () => <div><ScissorOutlined style={{ fontSize: '18px', marginRight: '8px' }} />移动</div>,
        okText: '重试',
        content: () => (
          <div>
            <div class="modal">
              <div class="modal__body">
                <Alert message="以下文件移动失败" type="info" />
                <FileErrorList files={errorFiles} onChange={(val) => retryList = val} />
              </div>
            </div>
          </div>
        ),
        onOk: () => {
          if (retryList.length) {
            files = (files as Array<IFile>).filter((_, idx: number) => retryList.includes(idx))
            //move((files as Array<IFile>).filter((_, idx: number) => retryList.includes(idx)))
            execMove()
          }
        },
      })
    }

    const modal = Modal.confirm({
      class: 'pure-modal',
      width: '500px',
      closable: true,
      title: () => <div><ScissorOutlined style={{ fontSize: '18px', marginRight: '8px' }} />移动</div>,
      content: () => (
        <div>
          <div class="modal">
            <div class="modal__body">
              {files.length == 1 ? <Meta style="margin:16px 0;" data={(files as Array<IFile>)[0]} /> : null}

              <Tree onSelect={onSelect} treeStyle={{ height: '250px' }} />
              {
                isTransfer.value ? [
                  <Alert style="margin:16px 0" message='您选择的是跨盘移动，后台将自动创建迁移任务。迁移成功后原始位置的文件不会被删除。' type="info" />,
                  // <div class="setting">
                  //   <div class="setting__item">
                  //     <div class="setting__item-label">同名文件</div>
                  //     <RadioGroup>
                  //       <Radio value="rename">重命名</Radio>
                  //       <Radio value="replace">替换</Radio>
                  //       <Radio value="skip">跳过</Radio>
                  //     </RadioGroup>
                  //   </div>
                  // </div>
                ] : null
              }
            </div>
          </div>
        </div>
      ),
      onOk: () => {
        execMove()
      },
    })

  }

  const mkdir = (i: IFile) => {

    let name = '新建文件夹'

    const onChange = (e: any) => {
      name = e.target.value
    }

    const onSave = async () => {
      if (name) {
        let res = await request.mkdir({ id: i.id, name })
        if (res.error) {
          message.error(res.error.message)
        } else {
          mutate(res, 1)
          modal.destroy()
        }
      }
    }


    const modal = Modal.confirm({
      class: 'pure-modal',
      width: '500px',
      closable: true,
      autoFocusButton: null,
      title: () => <div><EditOutlined style={{ fontSize: '18px', marginRight: '8px' }} />新建文件夹</div>,
      content: () => (
        <div class="modal__body">
          {useFocus(<Input class="sl-input" style="padding:1em;margin-top:16px;" defaultValue={name} onChange={onChange} />, true)}
        </div>
      ),
      onOk: onSave,
    })
  }

  const flashDownload = (i: any) => {
    let name = ref('')
    let hash = ref('')

    const onSave = async () => {
      console.log('>>', hash, name)
      if (hash.value && name.value) {
        let res = await request.fileHashDownload({ id: i.id, hash: hash.value, name: name.value })
        // console.log(res)
        if (res.error) {
          message.error(res.error.message)
          throw new Error()
        } else {
          message.success('秒传成功')
          mutate(res)
          modal.destroy()
        }
      }
    }


    const modal = Modal.confirm({
      class: 'pure-modal',
      width: '500px',
      closable: true,
      autoFocusButton: null,
      title: () => <div><CloudDownloadOutlined style={{ fontSize: '18px', marginRight: '8px' }} />云端秒传</div>,
      content: () => (
        <div>
          <div class="modal">
            <div class="modal__body">
              {
                i.uploadHash ? <Alert message={'当前云盘支持通过文件 ' + i.uploadHash + ' 值秒传'} type="info" /> : <Alert message="当前云盘不支持此功能" banner type="error" />
              }
              <Input class="sl-input" placeholder={`请输入${i.uploadHash || ''}`} style="padding:1em;margin-top:16px;" defaultValue={hash.value} onChange={e => (hash.value = e.target.value as string)} />
              <Input class="sl-input" placeholder='文件名' style="padding:1em;margin-top:16px;" defaultValue={name.value} onChange={e => (name.value = e.target.value as string)} />
            </div>
          </div>
        </div>
      ),
      onOk: onSave,
    })
  }

  const uploadConfirm = (files: Array<File>, dest: string, id: string) => {

    const { create } = useUpload()

    let checked: Array<number> = files.map((_, idx: number) => idx)

    const onChecked = (ids: Array<number>) => {
      checked = ids
    }

    const ensure = () => {
      const checkedFiles = checked.map((idx: number) => files[idx])
      create(checkedFiles, 'md5', dest, id)
      message.success('任务创建成功')
    }

    const data = files.map((i, idx) => ({
      idx: idx,
      id: i.name,
      size: i.size,
      name: i.name,
      ctime: i.lastModified,
      ctimeDisplay: time(i.lastModified),
      sizeDisplay: byte(i.size),
      iconType: getFileType(i.name),
      checked: true
    }))


    Modal.confirm({
      class: 'pure-modal',
      width: '500px',
      closable: true,
      title: () => <div><CloudUploadOutlined style={{ fontSize: '18px', marginRight: '8px' }} />文件上传</div>,
      content: <FileSelect files={data} onChange={onChecked} />,
      onOk: ensure,
    })

  }

  const remove = (files: IFile | Array<IFile>) => {
    if (!Array.isArray(files)) {
      files = [files]
    }

    if (files.some(i => i.type == 'drive')) {
      removeDisk(files.filter(i => i.type == 'drive'))
      return
    }
    let count = files.length

    const error: Array<any> = []
    const current = ref(0)
    const cancelFlag = ref(false)
    const key = '' + Math.random()
    const modal = Modal.confirm({
      title: '删除文件',
      content: `确认删除 ${count == 1 ? files[0].name : `${count} 项`}？`,
      onOk() {
        execRemove()
      },
      onCancel() {
        cancelFlag.value = true
      }
    })

    const execRemove = async () => {

      message.loading({ content: '正在删除', key, duration: 0 });

      for (let i of files as Array<IFile>) {
        if (cancelFlag.value) return
        message.loading({ content: `[${current.value + 1}/${count}]` + '正在删除:' + i.name, key, duration: 0 });

        let res = await request.fileDelete({ id: i.id })
        if (res.error) {
          error.push(i.id)
        } else {
          mutate(i, true)
        }
        current.value++
      }

      let errorFiles = files.filter((i: IFile) => error.includes(i.id))
      if (errorFiles.length) {
        return modal.update({
          content: () => <div><div>以下文件删除失败</div><FileSelect files={errorFiles} /></div>
        })
      } else {
        message.success({ content: '已成功删除', key, duration: 1 });
      }
    }

  }

  const setDisk = (data: IDrive, idx = -1, msg: string = '修改成功') => {
    const updateData = async (modifyData: IDrive) => {
      const saveData = [...config.drives]
      // console.log(saveData, idx)
      if (idx == -1) {
        saveData.push(modifyData)
      } else {
        saveData[idx] = modifyData
      }
      await setConfig({ drives: saveData }, msg)
      // update files

      if (!current.path || current.path == '/') {
        setPath({ path: '/' }, true)
      }
      modal.destroy()
    }

    const modal = Modal.confirm({
      class: 'fix-modal--alone',
      width: '720px',
      closable: true,
      content: (
        <div>
          <Modifier defaultValue={data} onUpdate={updateData} />
        </div>
      ),
      onOk: () => { },
    })
  }

  const addDisk = () => {
    setDisk(
      {
        name: '',
        protocol: '',
      },
      -1,
      '创建成功'
    )
  }

  const removeDisk = async (files: IFile | Array<IFile>) => {
    if (!Array.isArray(files)) {
      files = [files]
    }
    const execRemove = () => {
      const saveData = [...config.drives]

      for (let i of files as Array<IFile>) {
        let idx = saveData.findIndex(j => j.id == i.extra?.config_id)
        if (idx) {
          saveData.splice(idx, 1)
        }
      }

      setConfig({ drives: saveData }, '删除成功')

      if (!current.path || current.path == '/') {
        setPath({ path: '/' }, true)
      }
    }

    //await request.removeDrive({drive: files.map(i => i.id) })

    let count = files.length
    Modal.confirm({
      title: '删除挂载盘',
      content: `确认删除 ${count == 1 ? files[0].name : `${count} 项`}？`,

      onOk() {
        execRemove()
      },
      onCancel() {
      }
    })
  }

  const remoteDownload = (i: any) => {
    let url = ref('')

    const onSave = async () => {
      if (url.value) {
        let res = await request.remoteDownload({ dest: i.id, url: url.value })
        if (res.error) {
          message.error(res.error.message)
          throw new Error()
        } else {
          message.success('任务创建成功')
          modal.destroy()
        }
      }
    }


    const modal = Modal.confirm({
      class: 'pure-modal',
      width: '500px',
      closable: true,
      autoFocusButton: null,
      title: () => <div><DownloadOutlined style={{ fontSize: '18px', marginRight: '8px' }} />离线下载</div>,
      content: () => (
        <div>
          <div class="modal">
            <div class="modal__body">
              {
                i.remoteDownload != false ? <Alert message={'sharelist将在后台完成下载和上传过程。'} type="info" /> : <Alert message="当前挂载盘不支持此功能" banner type="error" />
              }
              {
                useFocus(<Input class="sl-input" placeholder={`请输入URL`} style="padding:1em;margin-top:16px;" defaultValue={url.value} onChange={e => (url.value = e.target.value as string)} />)
              }
            </div>
          </div>
        </div>
      ),
      onOk: onSave,
    })
  }

  return {
    rename, move, remove, mkdir, flashDownload, uploadConfirm,
    setDisk, addDisk, removeDisk, remoteDownload
  }
}