import { computed, defineComponent, PropType, inject } from 'vue'
import { Modal, message, Button } from 'ant-design-vue'

import './index.less'

type IStyle = {
  [key: string]: string | number
}
export default defineComponent({
  props: {
    color: {
      type: String,
      default: '',
    },
  },
  setup(props, ctx) {
    const { obj } = props
    const $electron = inject('$electron')
    const minimize = () => $electron.ipcRenderer.send('minimize')

    const close = () => {
      Modal.confirm({
        title: '提示',
        content: '此操作将Curve, 是否继续?',
        type: 'warning',
        onOk: () => {
          $electron.ipcRenderer.send('close')
        },
      })
    }
    const style: IStyle = {}
    // eslint-disable-next-line vue/no-setup-props-destructure
    if (props.color) style.color = props.color
    return (
      <div class="hintbar" style={style}>
        <a-button style={style} on-click={minimize} class="no-drag" size="small" type="link">
          <a-icon type="minus" />
        </a-button>
        <a-button style={style} on-click={close} class="no-drag hover-color" size="small" type="link">
          <a-icon type="close" />
        </a-button>
      </div>
    )
  },
})
