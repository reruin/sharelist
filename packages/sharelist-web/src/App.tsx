import { defineComponent } from 'vue'
import { ConfigProvider } from 'ant-design-vue'
import { RouterView } from 'vue-router'

export default defineComponent({
  setup() {
    return () => (
      <ConfigProvider locale={{ locale: 'zhCN' }}>
        <RouterView />
      </ConfigProvider>
    )
  },
})
