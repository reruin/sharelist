import { state } from './state'
import { createStore } from 'vuex'
import storage from 'store2'
import request from '@/utils/request'
import { ACCESS_TOKEN, USER_NAME, THEME } from './mutation-types'
import createPersistedState from 'vuex-persistedstate'

export default createStore({
  state,
  mutations: {
    SET_TOKEN: (state, data) => {
      state.accessToken = data
      //storage.set('ACCESS_TOKEN', data)
    },
    SET_THEME: (state, data) => {
      state.setting.theme = data
      //storage.set('SETTING', state.setting)
    },
    SET_LAYOUT: (state, data) => {
      state.setting.layout = data
      //storage.set('SETTING', state.setting)
    },
  },
  actions: {
    signin({ commit }, data) {
      return new Promise((resolve, reject) => {
        request
          .signin(data)
          .then((response: any) => {
            const result = response.result
            //storage.set(ACCESS_TOKEN, result.token, 30 * 24 * 60 * 60 * 1000)
            //storage.set(USER_NAME, result.user_name, 30 * 24 * 60 * 60 * 1000)
            commit('SET_TOKEN', result.token)
            commit('SET_NAME', result.user_name)
            resolve(response)
          })
          .catch((error: any) => {
            reject(error)
          })
      })
    },
    signout({ commit }) {
      return new Promise((resolve, reject) => {
        commit('SET_TOKEN', '')
        //storage.remove(ACCESS_TOKEN)
        request
          .signout(state.accessToken)
          .then(resolve)
          .catch(() => {
            resolve({})
          })
      })
    },
  },
  modules: {},
  plugins: [createPersistedState()],
})
