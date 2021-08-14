import { ref, defineComponent, watch, onMounted, toRef, reactive } from 'vue'
import { useStore } from 'vuex'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Layout, Button, Spin } from 'ant-design-vue'
import request from '@/utils/request'
import Icon from '@/components/icon'
import './index.less'
import { SettingOutlined, DatabaseOutlined, PoweroffOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { Tabs } from 'ant-design-vue'
const { TabPane } = Tabs
import General from './partial/general'
import Drive from './partial/disk'
import Signin from './partial/signin'
import { useSetting } from '@/hooks/useSetting'

export default defineComponent({
  setup() {
    const { loginState, isLoading, signout, clearCache } = useSetting()

    return () => (
      <div class="setting">
        <div class="settiing-header">
          {/* <LeftOutlined class="settiing-header__back" style={{ fontSize: '20px' }} /> */}
          <div>设置</div>
          {loginState.value == 1 ? (
            <div class="setting-header__actions">
              <DeleteOutlined onClick={clearCache} style={{ fontSize: '18px', marginRight: '16px' }} />
              <PoweroffOutlined onClick={signout} style={{ fontSize: '18px' }} />
            </div>
          ) : null}
        </div>
        <Spin spinning={isLoading.value}>
          {loginState.value == 1 ? (
            <Tabs>
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
