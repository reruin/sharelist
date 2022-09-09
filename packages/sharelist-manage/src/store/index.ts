import { defineStore } from 'pinia'

export default defineStore('sharelist_manage', {
  state: () => ({
    accessToken: '',
    layout: 'list',
    theme: 'light',
    path: '',
  }),

  actions: {
    saveToken(token: string) {
      this.accessToken = token
    },
    removeToken() {
      this.accessToken = ''
    },
    setLayout(val: string) {
      this.layout = val
    },
    savePath(input: string) {
      this.path = input
    },
  },

  persist: {
    enabled: true,
    strategies: [
      { storage: localStorage, paths: ['layout'] },
      { storage: sessionStorage, paths: ['accessToken'] },
    ],
  },
})
