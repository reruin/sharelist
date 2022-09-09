import { createRouter, createWebHashHistory, createWebHistory, RouteRecordRaw, onBeforeRouteLeave } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    component: () => import('../views/home'),
    redirect: '/drive/folder',
    children: [
      {
        path: '/general',
        name: 'general',
        component: () => import('../views/general'),
      },
      {
        path: '/drive/folder:path(.*)',
        name: 'drive',
        component: () => import('../views/disk'),
        /*
        children: [
          {
            path: 'folder:path(.*)',
            name: 'file',
            component: () => import('../views/disk/files'),
          },
        ],
        */
      },
      {
        path: '/plugin',
        name: 'plugin',
        component: () => import('../views/plugin'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory((window as any).MANAGE_BASE),
  routes,
})

export default router
