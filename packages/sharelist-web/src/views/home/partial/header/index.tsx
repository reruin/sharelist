import { ref, defineComponent, watch, onMounted } from 'vue'
import './index.less'
import Icon from '@/components/icon'
import { useStore } from 'vuex'
import { useToggle } from '@/hooks/useHooks'
// import Search from '../search'
import { Modal, InputSearch } from 'ant-design-vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import useUrlState from '@/hooks/useUrlState'
import { useConfig } from '@/hooks/useSetting'

export default defineComponent({
  setup() {
    const { state, commit } = useStore()

    const { setQuery, setPath } = useUrlState()

    const { config } = useConfig()

    const onChangeLayout = () => {
      commit('SET_LAYOUT', state.setting.layout == 'list' ? 'grid' : 'list')
    }

    const onToggleSearch = () => {
      const onSearch = (value: string) => {
        if (value) {
          // router.push({ path: router.currentRoute.value.path, query: { search: value } })
          setQuery({ search: value })
          modal.destroy()
        }
      }

      const modal = Modal.confirm({
        class: 'fix-modal--alone',
        width: '560px',
        maskClosable: true,
        content: (
          <div>
            <InputSearch enter-button placeholder="搜索内容" onSearch={onSearch} />
          </div>
        ),
      })
    }

    const navHome = () => setPath('/')

    return () => (
      <div class="drive-header">
        <div onClick={navHome} class="drive-header__name">
          {config.title || 'Sharelist'}
        </div>
        <div class="drive-action">
          {/* <Icon class="drive-action-search" type="icon-search" onClick={onToggleSearch} /> */}
          <Icon
            class={['drive-action-layout', 'drive-action-layout--' + state.setting.layout]}
            type={'icon-' + (state.setting.layout == 'list' ? 'grid' : 'list')}
            onClick={onChangeLayout}
          />
        </div>
      </div>
    )
  },
})
