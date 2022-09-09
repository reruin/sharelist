import { Modal, message } from 'ant-design-vue'
import { createVNode, VNode } from 'vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'

export default (fn: { (): any }, title = '确认', content = '') =>
  (): { destroy(): void; update(p: any): void } => {
    const modal = Modal.confirm({
      title,
      content,
      icon: createVNode(ExclamationCircleOutlined),
      onOk() {
        fn()
      },
    })
    return modal
  }

type ConfirmOption = {
  title: string
  content: string
  success?: string
  icon?: VNode
  onSuccess?: () => void
}
export const useApiConfirm = (
  fn: { (): Promise<any> },
  { title, content, success, icon, onSuccess }: ConfirmOption = { title: '确认', content: '' },
): void => {
  Modal.confirm({
    title,
    content,
    icon: icon || createVNode(ExclamationCircleOutlined),
    onOk() {
      return fn()
        .then((res) => {
          if (res.error) {
            message.error(res.error.message)
          } else {
            message.success(success || '操作完成')
            onSuccess?.()
          }
          return Promise.resolve()
        })
        .catch((e) => {
          message.error(e.message)
        })
    },
  })
}
