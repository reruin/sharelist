import { defineStore } from 'pinia'

export default defineStore('main', {
  state: () => ({
    theme: 'light',
    layout: 'list',
    sort: ['name', 'asc'],
  }),

  actions: {
    setLayout(val: string) {
      this.layout = val
    },
  },

  persist: {
    enabled: true,
  },
})
