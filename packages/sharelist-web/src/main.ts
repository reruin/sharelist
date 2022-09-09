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
