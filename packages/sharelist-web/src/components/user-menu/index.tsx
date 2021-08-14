import { computed, defineComponent } from 'vue'
import { useStore } from 'vuex'
import './index.less'

export default defineComponent({
  setup() {
    const store = useStore()
    const user = computed(() => store.state.user)

    const username = computed(() => {
      if (store.state.user) {
        return store.state.user.name.split('@')[0]
      } else {
        return ''
      }
    })

    return (
      <div class="user-menu">
        <a-avatar class="avatar" size={42} icon="user">
          {user.value.name}
        </a-avatar>
        <div class="userinfo">
          <h3>{username.value}</h3>
          <span>{user.value.info.userLicense ? user.value.info.userLicense.expiredTime : null}</span>
        </div>
      </div>
    )
  },
})
