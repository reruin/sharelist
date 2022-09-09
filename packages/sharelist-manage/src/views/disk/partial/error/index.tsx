import { defineComponent, watch } from 'vue'
import './index.less'
import { message } from 'ant-design-vue'
import AuthBox from '../auth'

export default defineComponent({
  props: {
    value: {
      type: Object,
      required: true,
    },
  },
  emits: ['auth'],
  setup(props, ctx) {
    if (props.value.code == 401 && props.value.message) {
      message.error(props.value.message)
    }
    return () => {
      if (props.value.code) {
        return props.value.code == 401 ? (
          <AuthBox scope={props.value.scope} onAuth={(d) => ctx.emit('auth', d)} />
        ) : (
          <div class="err">
            <h1 class="err__status">{props.value.code}</h1>
            <div class="err__msg">{props.value.message}</div>
          </div>
        )
      } else {
        return ctx.slots.default?.()
      }
    }
  },
})
