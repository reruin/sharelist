import { computed, defineComponent } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import { Modal, message, Button } from 'ant-design-vue'
import { GlobalOutlined, SettingOutlined } from '@ant-design/icons-vue'

import './index.less'

export default defineComponent({
  setup() {
    const store = useStore()
    const route = useRoute()
    const router = useRouter()

    const defActive = computed(() => route.name)
    const link = (name: string) => router.push({ name })

    const signout = (): void => {
      Modal.confirm({
        title: '提示',
        content: '确定要注销登录吗 ?',
        onOk: () => {
          return store
            .dispatch('signout', {})
            .then(() => {
              window.location.reload()
            })
            .catch((err) => {
              message.error({
                title: '错误',
                description: err.message,
              })
            })
        },
        onCancel() {
          //
        },
      })
    }
    return (
      <div class="sider">
        <div class="sider-body">
          <div class="logo">CURVE</div>
          <div class="menu">
            <a-button
              on-click={() => link('node')}
              class={{ 'no-drag': true, active: defActive.value == 'node' }}
              type="link"
            >
              <GlobalOutlined />
            </a-button>

            {/*            <a-button on-click={()=>this.link('invoice')} class={{'no-drag':true , 'active':this.defActive == 'invoice'}}  type="link">
          <a-icon type="pay-circle" />
        </a-button>*/}
          </div>
          {/*<a-menu theme="dark" mode="inline">
        <a-menu-item key="1">
          <a-icon style={{fontSize:'24px'}} type="user" />
          <span>用户</span>
        </a-menu-item>
        <a-menu-item key="2">
          <a-icon style={{fontSize:'24px'}} type="pay-circle" />
          <span>订单</span>
        </a-menu-item>
        <a-menu-item key="3">
          <a-icon style={{fontSize:'24px'}} type="setting" />
          <span>设置</span>
        </a-menu-item>
      </a-menu>*/}
        </div>
        <div class="sider-footer">
          <a-button
            on-click={() => link('option')}
            class={{ 'no-drag': true, active: defActive.value == 'option' }}
            type="link"
          >
            <SettingOutlined />
          </a-button>
          {/*<a-button on-click={this.signout} class="no-drag" size="small" type="link">
        <a-icon type="poweroff" />
      </a-button>*/}
        </div>
      </div>
    )
  },
})
