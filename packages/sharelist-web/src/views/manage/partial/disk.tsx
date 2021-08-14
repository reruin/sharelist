import { ref, defineComponent, watch, onMounted, toRef, toRefs, reactive, watchEffect } from 'vue'
import Icon from '@/components/icon'
import { useSetting } from '@/hooks/useSetting'
import { Layout, Button, Form, Modal, Popconfirm } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'

import Modifier from './drive-modifier'

export default defineComponent({
  setup() {
    const { config, setConfig } = useSetting()

    const drives = config.drives

    const createModifier = (data: IDrive, idx = -1) => {
      const updateData = (modifyData: IDrive) => {
        const saveData = [...drives]
        if (idx == -1) {
          saveData.push(modifyData)
        } else {
          console.log('mod', idx, modifyData)
          saveData[idx] = modifyData
        }
        setConfig({ drives: saveData })
        modal.destroy()
      }

      const modal = Modal.confirm({
        class: 'fix-modal--alone',
        width: '720px',
        closable: true,
        content: (
          <div>
            <Modifier defaultValue={data} onUpdate={updateData} />
          </div>
        ),
        onOk: () => { },
      })
    }

    const onCreateDrive = () => {
      createModifier(
        {
          name: '',
          path: {
            protocol: '',
          },
        },
        -1,
      )
    }

    const remove = (data: IDrive, idx: number) => {
      setConfig({ drives: drives.filter((_: any, i: number) => i != idx) })
    }

    const orderUp = (data: IDrive, idx: number) => {
      if (idx > 0) {
        const saveData = [...drives]
        const a = drives[idx - 1],
          b = drives[idx]
        saveData[idx - 1] = b
        saveData[idx] = a
        setConfig({ drives: saveData })
      }
    }

    return () => (
      <div>
        <div class="setting-drive__header">
          <Button type="primary" onClick={onCreateDrive}>
            {{
              default: () => '创建挂载',
              icon: () => <PlusOutlined />,
            }}
          </Button>
        </div>
        <div>
          {config.drives.map((i: IDrive, idx: number) => (
            <div class="item">
              <div class="item__header">
                <Icon class="item__icon" style={{ fontSize: '32px' }} type="icon-folder" />
                <div class="item__meta">
                  <h4 class="item__meta-title">{i.name}</h4>
                  <div class="item__meta-desc">{i.path.protocol}</div>
                </div>
              </div>
              <div class="item-action">
                <a onClick={() => createModifier(i, idx)}>修改</a>
                <Popconfirm title="确认移除?" ok-text="确定" cancel-text="取消" onConfirm={() => remove(i, idx)}>
                  <a>移除</a>
                </Popconfirm>
                <a onClick={() => orderUp(i, idx)}>上移</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
})
