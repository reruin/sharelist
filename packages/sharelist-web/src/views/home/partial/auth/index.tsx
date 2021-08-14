import { ref, defineComponent, watch, onMounted, toRef, watchEffect, reactive } from 'vue'
import { useStore } from 'vuex'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Layout, Button, Form, Input } from 'ant-design-vue'
import { useSetting } from '@/hooks/useSetting'
import useUrlState from '@/hooks/useUrlState'

import './index.less'

export default defineComponent({
  setup() {
    const { setQuery } = useUrlState()

    const token = ref('')
    const onEnter = () => {
      setQuery({ auth: token.value })
    }

    return () => (
      <div class="auth-box">
        <div class="auth-box-wrap">
          <Input
            class="auth-box__input"
            value={token.value}
            onChange={(e) => (token.value = e.target.value)}
            placeholder="输入密码"
            onPressEnter={onEnter}
          />
          <Button class="auth-box__btn" type="primary" onClick={onEnter}>
            确定
          </Button>
        </div>
      </div>
    )
  },
})
