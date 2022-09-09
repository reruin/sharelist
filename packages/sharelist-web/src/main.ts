import { createApp, h } from 'vue'
import App from './App'
import store from './store'
import router from './router'
import { message, Spin, ConfigProvider } from 'ant-design-vue'
import apis from '@/config/api'
import { createApi } from '@/hooks/useApi'
import { createPinia } from 'pinia'
import piniaPersist from 'pinia-plugin-persist'
// import 'ant-design-vue/es/style/index.less'
import 'ant-design-vue/es/button/style'
import 'ant-design-vue/es/radio/style'
import 'ant-design-vue/es/breadcrumb/style'
import 'ant-design-vue/es/input/style'
import 'ant-design-vue/es/message/style'
import 'ant-design-vue/es/modal/style'
import 'ant-design-vue/es/spin/style'
import 'ant-design-vue/es/popover/style'
import 'ant-design-vue/es/list/style'
import 'ant-design-vue/es/image/style'
import '@/assets/style/index.less'

import { LoadingOutlined } from '@ant-design/icons-vue'

Spin.setDefaultIndicator({
  indicator: h(LoadingOutlined, {
    style: {
      fontSize: '24px',
    },
    spin: true,
  }),
})

ConfigProvider.config({
  theme: {
    primaryColor: 'rgb(100,58,218)',
  },
  autoInsertSpaceInButton: false,
})

const pinia = createPinia()
pinia.use(piniaPersist)
createApi(apis)

createApp(App).use(router).use(pinia).provide('$message', message).mount('#app')
