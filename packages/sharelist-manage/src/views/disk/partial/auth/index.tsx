import { ref, defineComponent, watch, onMounted, toRef, watchEffect, reactive } from 'vue'
import { Button, Input } from 'ant-design-vue'
import useDisk from '../useDisk'
import { LockOutlined } from '@ant-design/icons-vue'
import './index.less'

export default defineComponent({
  props: {
    message: {
      type: String
    },
    scope: {
      type: Object
    }
  },
  emits: ['auth'],
  setup(props) {
    const { setAuth } = useDisk()

    const token = ref('')
    const onEnter = () => {
      let set: Record<string, string> = {
        token: token.value
      }
      setAuth({ id: props.scope?.id, path: props.scope?.path, token: token.value })
    }

    watch(() => props.scope, () => {
      token.value = ''
    })

    return () => (
      <div class="auth-box">

        <div class="auth-box__wrap">
          {
            props.scope?.path ? <h2 class="auth-box__header">{props.scope?.path} 需要身份验证</h2> : null
          }
          <Input.Password
            class="auth-box__input"
            value={token.value}
            onChange={(e) => (token.value = e.target.value as string)}
            placeholder="输入目录访问密码"
            onPressEnter={onEnter}
          >
            {{
              prefix: () => <LockOutlined />
            }}
          </Input.Password>
          <Button class="auth-box__btn" type="primary" onClick={onEnter}>
            确定
          </Button>
        </div>
      </div>
    )
  },
})
