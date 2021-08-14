import { ref, defineComponent, watch, onMounted, toRef, watchEffect, reactive } from 'vue'
import { useStore } from 'vuex'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Layout, Button, Form, Input } from 'ant-design-vue'
import { useSetting } from '@/hooks/useSetting'

export default defineComponent({
  setup() {
    const { getConfig } = useSetting()

    const token = ref('')
    const onEnter = () => {
      getConfig(token.value)
    }

    return () => (
      <div class="setting-signin">
        <div class="setting-signin-wrap">
          <Input
            class="setting-signin__input"
            type="password"
            value={token.value}
            onChange={(e) => (token.value = e.target.value)}
            placeholder="输入口令"
            onPressEnter={onEnter}
          />
          <Button class="setting-signin__btn" type="primary" onClick={onEnter}>
            确定
          </Button>
        </div>
      </div>
    )
  },
})
