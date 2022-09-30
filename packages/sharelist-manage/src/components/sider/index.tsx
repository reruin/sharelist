import './index.less'
import { ref, defineComponent, computed, watch, onMounted, onUnmounted, toRefs, reactive, watchEffect } from 'vue'
import { DatabaseOutlined, AppstoreAddOutlined, SettingOutlined, ReloadOutlined, PoweroffOutlined } from '@ant-design/icons-vue'
import { useRouter, useRoute, RouterLink, onBeforeRouteUpdate } from 'vue-router'
import useConfirm from '@/hooks/useConfirm'
import { useSetting } from '@/hooks/useSetting'
import useDriveStore from '@/store/index'
import { Dropdown, Menu } from 'ant-design-vue'

export default defineComponent({
  setup() {

    let driveStore = useDriveStore()

    onBeforeRouteUpdate((to, from) => {
      if (from.name == 'drive') {
        driveStore.savePath(from.fullPath)
      }
    })

    const router = useRouter()
    const route = useRoute()
    const navToDrive = () => {
      router.push(driveStore.path || '/drive/folder')
    }

    const { signout, reload } = useSetting()

    const confirmSignout = useConfirm(signout, '确认', '确认退出？')
    const confirmReload = useConfirm(reload, '确认', '确认重新加载插件？')

    const curRoute = computed(() => route.name)

    const onAction = ({ key }: { key: string }) => {
      if (key == 'exit') {
        confirmSignout()
      } else if (key == 'reload') {
        confirmReload()
      }
    }
    return () => <div class="sider">
      <div class="sider-body">
        <div class="logo">SL</div>
        <div class="menu">

          <div class={{ link: true, active: curRoute.value == 'drive' || curRoute.value == 'drive-map' }} onClick={navToDrive}>
            <DatabaseOutlined />
          </div>
          <RouterLink to="/plugin" class={{ link: true, active: curRoute.value == 'plugin' }}>
            <AppstoreAddOutlined />
          </RouterLink>
          <RouterLink to="/general" class={{ link: true, active: curRoute.value == 'general' }}>
            <SettingOutlined />
          </RouterLink>

        </div>
      </div>
      <div class="sider-footer" >
        {/* <ReloadOutlined onClick={confirmReload} style={{ fontSize: '16px', color: '#1b2539', marginBottom: '16px' }} /> */}
        <Dropdown overlayClassName="dropdown--drive" trigger={['click']}>
          {{
            default: () => <PoweroffOutlined style={{ fontSize: '18px' }} />,
            overlay: () => (
              <Menu onClick={onAction}>
                <Menu.Item class="dropdown-item" key="reload"><ReloadOutlined style={{ fontSize: '18px', marginRight: '8px' }} />重载插件</Menu.Item>
                <Menu.Item class="dropdown-item" key="exit"><PoweroffOutlined style={{ fontSize: '18px', marginRight: '8px' }} />退出</Menu.Item>
              </Menu>
            )
          }}
        </Dropdown>
      </div>
    </div >
  }
})