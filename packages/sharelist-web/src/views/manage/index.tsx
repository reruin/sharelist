import { ref, defineComponent, watch, onMounted, toRef, reactive } from 'vue'
import { useStore } from 'vuex'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Layout, Button, Spin } from 'ant-design-vue'
import request from '@/utils/request'
import Icon from '@/components/icon'
import './index.less'
import { SettingOutlined, DatabaseOutlined, PoweroffOutlined, DeleteOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { Tabs } from 'ant-design-vue'
const { TabPane } = Tabs
import General from './partial/general'
import Drive from './partial/disk'
import Signin from './partial/signin'
import { useSetting, useConfig } from '@/hooks/useSetting'
import useConfirm from '@/hooks/useConfirm'
import { useTitle } from '@/hooks/useHooks'

export default defineComponent({
  setup() {
    const { loginState, isLoading, signout, exportConfig, reload, clearCache } = useSetting()

    const confirmClearCache = useConfirm(clearCache, '确认', '确认清除缓存？')

    const confirmSignout = useConfirm(signout, '确认', '确认退出？')

    const confirmReload = useConfirm(reload, '确认', '确认重启？')

    const tabsSlots = {
      tabBarExtraContent: () => <div style="cursor:pointer;font-size:12px;color:#666;" title="保存配置 / Save config" onClick={exportConfig} ><SaveOutlined style={{ fontSize: '15px', 'marginRight': '6px' }} />导出配置</div>
    }
    const { config } = useConfig()

    watch(() => config.title, (nv) => {
      useTitle(nv)
    })

    return () => (
      <div class="setting">
        <div class="settiing-header">
          {/* <LeftOutlined class="settiing-header__back" style={{ fontSize: '20px' }} /> */}
          <div>设置</div>
          {loginState.value == 1 ? (
            <div class="setting-header__actions">
              <DeleteOutlined onClick={confirmClearCache} style={{ fontSize: '18px', marginRight: '16px' }} />
              <ReloadOutlined onClick={confirmReload} style={{ fontSize: '18px', marginRight: '16px' }} />
              <PoweroffOutlined onClick={confirmSignout} style={{ fontSize: '18px' }} />
            </div>
          ) : null}
        </div>
        <Spin spinning={isLoading.value}>
          {loginState.value == 1 ? (
            <Tabs v-slots={tabsSlots}>
              <TabPane key="general">
                {{
                  default: () => <General />,
                  tab: () => (
                    <span>
                      <SettingOutlined />
                      常规
                    </span>
                  ),
                }}
              </TabPane>
              <TabPane key="drive">
                {{
                  default: () => <Drive />,
                  tab: () => (
                    <span>
                      <DatabaseOutlined />
                      挂载盘
                    </span>
                  ),
                }}
              </TabPane>
            </Tabs>
          ) : loginState.value == 2 ? (
            <Signin />
          ) : null}
        </Spin>
      </div>
    )
  },
})
