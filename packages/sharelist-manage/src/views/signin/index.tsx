import { ref, defineComponent } from 'vue'
import { Button, Input } from 'ant-design-vue'
import { useSetting } from '@/hooks/useSetting'
import './index.less'

export default defineComponent({
  setup() {
    const { getConfig } = useSetting()

    const token = ref('')
    const onEnter = () => {
      getConfig(token.value)
    }

    return () => (
      <div class="page-signin">
        <div class="page-logo">
          <span>sharelist</span>
        </div>
        <div class="page-signin-wrap">
          <div class="page-header">登录 / Sign In</div>

          <Input
            class="page-signin__input"
            type="password"
            value={token.value}
            onChange={(e) => (token.value = e.target.value)}
            placeholder="输入口令"
            onPressEnter={onEnter}
          />
          <Button class="page-signin__btn" type="primary" onClick={onEnter}>
            确定
          </Button>
        </div>
      </div>
    )
  },
})
