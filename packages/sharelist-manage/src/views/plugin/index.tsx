import { ref, defineComponent, watch, onMounted, toRef, toRefs, reactive, watchEffect } from 'vue'
import Icon from '@/components/icon'
import { useSetting } from '@/hooks/useSetting'
import { Button, Modal, Popconfirm, Tooltip, Dropdown, Menu, Empty } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined, EditOutlined, LoadingOutlined, HomeOutlined, SyncOutlined, AppstoreOutlined, EllipsisOutlined } from '@ant-design/icons-vue'
import CodeEditor from '@/components/code-editor'
import './index.less'
import Store from './partial/store'

const defaultNewPlugin = `//===Sharelist===
// @name         插件名  e.g. NewSharelistPlugin
// @namespace    命名空间 用于区分插件。e.g. https://new.sharelist.plugin
// @version      版本号 e.g. 1.0.0
// @license      协议 e.g. MIT
// @description  描述
// @author       作者
// @supportURL   插件主页
// @updateURL    插件更新地址
// @icon         插件图标URL 支持base64
//===/Sharelist==`
export default defineComponent({
  setup() {
    const { config, getPlugin, setPlugin, removePlugin, upgradePlugin } = useSetting()

    const update = (data: IPlugin) => {
      let newData = ''

      const show = (input: string) => {
        Modal.confirm({
          class: 'pure-modal',
          title: data.name,
          width: '720px',
          closable: true,
          content: (
            <div>
              <CodeEditor style="max-height:65vh;" defaultValue={input} onUpdate={(data: string) => newData = data} />
            </div>
          ),
          onOk: () => setPlugin(data.id, newData),
        })
      }

      if (data.id) {
        getPlugin(data.id).then((res: any) => {
          show(res)
        })
      } else {
        show(defaultNewPlugin)
      }

    }

    const remove = (data: IPlugin, idx: number) => {
      Modal.confirm({
        title: '移除插件',
        content: `确认删除 ${data.name}？`,
        onOk() {
          removing[data.id] = true

          removePlugin(data.id).then(() => {
            delete removing[data.id]
          })
        },
        onCancel() {
        }
      })

    }

    const installing: Record<string, boolean> = reactive({})

    const removing: Record<string, boolean> = reactive({})

    const upgrade = (data: IPlugin) => {
      installing[data.id] = true

      upgradePlugin(data.id).then((res: any) => {
        delete installing[data.id]
      })
    }

    const onAction = ({ key }: { key: any }) => {
      if (key == 'store') {
        const modal = Modal.confirm({
          class: 'pure-modal pure-modal-hide-footer',
          width: '890px',
          closable: true,
          title: () => <div><AppstoreOutlined style={{ fontSize: '18px', marginRight: '8px' }} />插件中心</div>,
          maskClosable: false,
          content: <Store />
        })
      } else {
        update({ id: '', name: '新建插件' })
      }
    }
    return () => (

      <div class="page page--plugin">
        <div class="page__header">
          <div>插件</div>
          <div class="page__action">
            <Dropdown overlayClassName="dropdown--drive" trigger={['click']}>
              {{
                default: () => <PlusOutlined style={{ fontSize: '18px', marginLeft: '16px' }} />,
                overlay: () => (
                  <Menu onClick={onAction}>
                    <Menu.Item class="dropdown-item" key="store" ><AppstoreOutlined style={{ fontSize: '18px', marginRight: '8px' }} />插件中心</Menu.Item>
                    <Menu.Item class="dropdown-item" key="create"><EditOutlined style={{ fontSize: '18px', marginRight: '8px' }} />新建插件</Menu.Item>
                  </Menu>
                )
              }}
            </Dropdown>
          </div>
        </div>
        <div>
          {config.plugins.length == 0 ? <div class="page_empty">
            <Empty style={{ height: '60vh' }}>
              {{
                description: () => <div><a onClick={() => onAction({ key: 'new' })}>创建插件</a><span style="margin:0 8px;">或者</span><a onClick={() => onAction({ key: 'store' })}>从插件中心安装</a></div>
              }}
            </Empty>
          </div> : <div class="page-content">{config.plugins?.map((i: IPlugin, idx: number) => (
            <div class={['item', 'item--plugin', (installing[i.id] || removing[i.id]) ? 'item--aciton-visible' : null]}>
              <div class="item__header">
                {
                  i.icon ?
                    <div class="item__icon" style={{ backgroundImage: `url(${i.icon})` }}></div> :
                    <Icon class="item__icon" style={{ fontSize: '36px', color: '#888' }} type="icon-puzzle" />
                }
                <div class="item__meta">
                  <div class="item__meta-head">
                    <div class="flex flex--between">
                      <h4 class="item__meta-title">{i.name}</h4>
                      <div class="item-action">
                        {i.supportURL && (i.supportURL as string).startsWith('http') ? <Tooltip title="主页"><a target="_blank" href={i.supportURL as string}><HomeOutlined /></a></Tooltip> : null}
                        {i.updateURL ? <Tooltip title="更新"><a onClick={() => upgrade(i)}><SyncOutlined spin={installing[i.id]} /></a></Tooltip> : null}
                        <a onClick={() => update(i)}><EditOutlined style={{ fontSize: '15px' }} /></a>
                        <a onClick={() => remove(i, idx)}>{removing[i.id] ? <LoadingOutlined style={{ fontSize: '15px' }} /> : <DeleteOutlined class="danger-aciton--hover" style={{ fontSize: '15px' }} />}</a>
                      </div>
                    </div>
                    {i.version ? <span>Version {i.version}</span> : null}
                  </div>
                  <div class="item__meta-desc ellipsis-2">
                    {i.description}
                    {/* {i.supportURL && (i.supportURL as string).startsWith('http') ? <Tooltip title="主页"><a target="_blank" href={i.supportURL as string} style="padding:0 8px;"><HomeOutlined /></a></Tooltip> : null}
                    {i.license ? <a class="flex">
                      <Icon style={{ fontSize: '13px', 'marginRight': '5px' }} type="icon-license" />
                      {i.license}
                    </a> : null} */}
                  </div>
                  {/* <div class="item__meta-desc flex" style="align-items:center;margin-top:16px;">
                    <ul class="split">
                      {i.supportURL && (i.supportURL as string).startsWith('http') ? <Tooltip title="主页"><li><a target="_blank" href={i.supportURL as string}><HomeOutlined /></a></li></Tooltip> : null}

                      {i.license ? <li><a class="flex" style="margin-left:8px;">
                        <Icon style={{ fontSize: '12px', marginRight: '3px' }} type="icon-license" />
                        {i.license}
                      </a></li> : null}
                    </ul>
                  </div> */}

                </div>
              </div>

            </div>
          ))}</div>}
        </div>
      </div>
    )
  },
})
