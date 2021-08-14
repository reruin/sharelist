import { ref, defineComponent, watch, onMounted, toRef, toRefs, reactive } from 'vue'
import { useStore } from 'vuex'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Layout, Button, Form } from 'ant-design-vue'
import request from '@/utils/request'
import Icon from '@/components/icon'
import { SettingOutlined, DatabaseOutlined } from '@ant-design/icons-vue'
import { useSetting } from '@/hooks/useSetting'
import { Switch, Modal, Input } from 'ant-design-vue'
const { TextArea } = Input
const valueDisplay = (value: any, type: string) => {
  if (type == 'boolean') return Boolean(value) ? '启用' : '禁用'
  else if (type == 'string') return value
  else if (type == 'array') {
    const len = value.length
    const nodes = value.slice(0, 3).map((i: string) => <div>{i}</div>)
    if (len > 3) {
      nodes.push(<div>等{len}项</div>)
    }
    return nodes
  }
}

export default defineComponent({
  setup() {
    const fields = [
      { code: 'title', label: '网站标题', type: 'string' },
      { code: 'index_enable', label: '目录索引', type: 'boolean' },
      { code: 'expand_single_disk', label: '展开单一挂载盘', type: 'boolean' },
      { code: 'anonymous_download_enable', label: '允许下载', type: 'boolean' },
      { code: 'fast_mode', label: '快速模式', type: 'boolean' },
      { code: 'ignores', label: '忽略路径', type: 'array' },
    ]
    const { config, setConfig } = useSetting()

    const createInputModifier = (label: string, code: string) => {
      const modifier = ref(config[code])
      Modal.confirm({
        title: label,
        class: 'fix-modal--narrow-padding',
        content: (
          <div>
            <TextArea v-model={[modifier.value, 'value']} placeholder="请输入" />
          </div>
        ),
        onOk: () => {
          setConfig({ [code]: modifier.value })
        },
      })
    }

    const createListModifier = (label: string, code: string) => {
      const modifier = ref(config[code].join('\n'))
      Modal.confirm({
        title: label,
        class: 'fix-modal--narrow-padding',
        content: (
          <div>
            <TextArea v-model={[modifier.value, 'value']} style={{ height: '150px' }} placeholder="请输入" />
          </div>
        ),
        onOk: () => {
          setConfig({ [code]: modifier.value.split('\n').filter(Boolean) })
        },
      })
    }

    return () => (
      <div>
        {fields.map((i) => (
          <div class="item">
            <div class="item__header">
              <div class="item__meta">
                <h4 class="item__meta-title">{i.label}</h4>
                <div class="item__meta-desc">{valueDisplay(config[i.code], i.type)}</div>
              </div>
            </div>
            <div class="item-action">
              {i.type == 'boolean' ? (
                <Switch checked={config[i.code]} onChange={(e) => setConfig({ [i.code]: e })} />
              ) : i.type == 'string' ? (
                <a onClick={() => createInputModifier(i.label, i.code)}>修改</a>
              ) : i.type == 'array' ? (
                <a onClick={() => createListModifier(i.label, i.code)}>修改</a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    )
  },
})
