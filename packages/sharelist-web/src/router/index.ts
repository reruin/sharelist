import { defineAsyncComponent } from 'vue'
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/:path(.*)',
    name: 'home',
    component: () => import('../views/home'),
  },
]
const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
