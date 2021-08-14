import { createApp } from 'vue'
import App from './App'
import store from './store'
import router from './router'
import { message } from 'ant-design-vue'
// console.log('electron-store', new Store())

import 'ant-design-vue/dist/antd.less'
import '@/assets/style/index.less'

createApp(App).use(router).use(store).provide('$message', message).mount('#app')
