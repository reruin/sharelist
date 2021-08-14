import { defineComponent, watch } from 'vue'
import './index.less'
import AuthBox from '../auth'
import { message } from 'ant-design-vue'

export default defineComponent({
  props: {
    value: {
      type: Object,
      required: true,
    },
  },
  setup(props, ctx) {
    if (props.value.code == 401 && props.value.message) {
      message.error(props.value.message)
    }
    return () => {
      if (props.value.code) {
        return props.value.code == 401 ? (
          <AuthBox />
        ) : (
          <div class="err">
            <h1 class="err__status">{props.value.code}</h1>
            <div class="err__msg">{props.value.msg}</div>
          </div>
        )
      } else {
        return ctx.slots.default?.()
      }
    }
  },
})
