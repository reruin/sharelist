import { ref, defineComponent, watch, onMounted, toRef, toRefs, reactive, watchEffect, Ref, computed } from 'vue'
import Icon from '@/components/icon'
import { useSetting } from '@/hooks/useSetting'
import { Button, Modal, Popconfirm, Tooltip, Dropdown, Menu, message, Spin } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined, EditOutlined, LoadingOutlined, HomeOutlined, SyncOutlined, AppstoreOutlined, CheckOutlined } from '@ant-design/icons-vue'
import CodeEditor from '@/components/code-editor'
import './index.less'
import { useApi } from "@/hooks/useApi";
import { useRequest } from '@/hooks/useRequest'


export default defineComponent({
  setup() {
    const request = useApi()
    const { config } = useSetting()

    const installingList: Record<string, boolean> = reactive({})
    const { reloadConfig } = useSetting()
    let { loading, run, data } = useRequest(async () => {
      let res = await request.pluginStore()
      if (res.error) {
        message.error(res.error.message)
      } else {
        console.log(res)
        return res
      }
    }, { immediate: true })

    let { loading: installing, run: install } = useRequest(async (i) => {
      installingList[i.namespace] = true
      let res = await request.installPlugin({ url: i.updateURL })
      delete installingList[i.namespace]
      if (res.error) {
        message.error(res.error.message)
      } else {
        message.success('安装成功')
        reloadConfig()
      }
    })

    const installed = computed(() => {
      const ret: Record<string, boolean> = {}
      config.plugins.forEach((i: any) => {
        ret[i.namespace] = true
      })
      return ret
    })
    return () =>
      <Spin delay={150} spinning={loading.value}>
        <div class="plugin-store">
          {
            data?.value?.map((i: any) => <div class="plugin-item" >


              <div class="plugin-item-content" >

                <div class="item-hd flex flex--between">
                  {
                    i.icon ? <div class="plugin-item-icon" style={{ backgroundImage: `url(${i.icon})` }}>
                    </div> : <div class="plugin-item-icon"><Icon type="icon-puzzle" style={{ fontSize: '32px', 'color': '#aaa' }} /></div>
                  }
                  {
                    installed.value[i.namespace] ?
                      <div class="plugin-item__install  plugin-item__install--checked" title={i.namespace}><CheckOutlined style={{ marginRight: '8px' }} />已安装</div> :
                      installingList[i.namespace] ? <div class="plugin-item__install  plugin-item__install--checked"><LoadingOutlined style={{ marginRight: '8px' }} />安装中</div> : <div class="plugin-item__install" onClick={() => install(i)}>安装</div>
                  }
                </div>
                <div class="item-bd">
                  <div class="plugin-item__name">{i.name}</div>
                  <div class="ellipsis-2">{i.description}</div>
                </div>
                <div class="item-ft">
                  <ul class="split">
                    {i.supportURL && (i.supportURL as string).startsWith('http') ? <Tooltip title="主页"><li><a target="_blank" href={i.supportURL as string}><HomeOutlined /></a></li></Tooltip> : null}

                    {i.license ? <li><a class="flex" style="margin-left:8px;">
                      <Icon class="item__icon" style={{ fontSize: '12px', marginRight: '3px' }} type="icon-license" />
                      {i.license}
                    </a></li> : null}
                    {i.version ? <li><span style="margin-left:8px;">v{i.version}</span></li> : null}
                  </ul>

                </div>
              </div>
            </div>)
          }
        </div >
      </Spin>
  }
})