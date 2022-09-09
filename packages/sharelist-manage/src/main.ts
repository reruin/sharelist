import { createApp, h } from 'vue'
import App from './App'
import router from './router'
import { message, Spin, ConfigProvider } from 'ant-design-vue'
import { createPinia } from 'pinia'
import piniaPersist from 'pinia-plugin-persist'
import apis from '@/config/api'
import { createApi } from '@/hooks/useApi'
import useStore from '@/store/index'

// import 'ant-design-vue/dist/antd.variable.less'

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

createApi(apis, {
  onReq(params, options) {
    if (options.token) {
      params.headers['Authorization'] = useStore().accessToken
    }
  },
})

createApp(App)
  .use(router)
  .use(pinia)

  // .use(
  //   createApi(apis, {
  //     onReq(params, options) {
  //       if (options.token) {
  //         params.headers['Authorization'] = useStore().accessToken
  //       }
  //     },
  //   }),
  // )
  .provide('$message', message)
  .mount('#app')
