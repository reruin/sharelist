import { Modal } from 'ant-design-vue'
import './index.less'
export const modal = function (options: any) {
  const { content, title, ...rest } = options

  const node = () => <div class="modal">
    <div class="modal__header">{title}</div>
    <div class="modal__body">{content}</div>
  </div>
  Modal.confirm({
    ...rest,
    class: 'hide--modal',
    content: node
  })
}