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
      { code: 'token', label: '后台密码', type: 'string', secret: true },
      { code: 'title', label: '网站标题', type: 'string' },
      { code: 'index_enable', label: '目录索引', type: 'boolean' },
      { code: 'expand_single_disk', label: '展开单一挂载盘', type: 'boolean' },
      { code: 'anonymous_download_enable', label: '允许下载', type: 'boolean' },
      { code: 'fast_mode', label: '快速模式', type: 'boolean' },
      { code: 'ignores', label: '忽略路径', type: 'array' },
      { code: 'acl_file', label: '加密文件名', type: 'string' },
      { code: 'webdav_path', label: 'WebDAV 路径', type: 'string' },
      { code: 'webdav_proxy', label: 'WebDAV 代理', type: 'boolean' },
      { code: 'webdav_user', label: 'WebDAV 用户名', type: 'string' },
      { code: 'webdav_pass', label: 'WebDAV 密码', type: 'string' },
      { code: 'script', label: '自定义脚本', type: 'string' },
      { code: 'style', label: '自定义样式', type: 'string' },
    ]
    const { config, setConfig } = useSetting()

    const createInputModifier = (label: string, code: string, isSecret: boolean | undefined) => {
      const modifier = ref(isSecret ? '' : config[code])
      const handleChange = (e: any) => modifier.value = e.target.value

      //modal 下的input v-model 有bug
      Modal.confirm({
        title: label,
        class: 'fix-modal--narrow-padding',
        content: (
          <div>
            <TextArea defaultValue={modifier.value} onChange={handleChange} placeholder="请输入" />
          </div>
        ),
        onOk: () => {
          setConfig({ [code]: modifier.value })
        },
      })
    }

    const createListModifier = (label: string, code: string) => {
      const modifier = ref(config[code].join('\n'))
      const handleChange = (e: any) => modifier.value = e.target.value

      Modal.confirm({
        title: label,
        class: 'fix-modal--narrow-padding',
        content: (
          <div>
            <TextArea defaultValue={modifier.value} onChange={handleChange} style={{ height: '150px' }} placeholder="请输入" />
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
                <div class="item__meta-desc">{i.secret ? '' : valueDisplay(config[i.code], i.type)}</div>
              </div>
            </div>
            <div class="item-action">
              {i.type == 'boolean' ? (
                <Switch checked={config[i.code]} onChange={(e) => setConfig({ [i.code]: e })} />
              ) : i.type == 'string' ? (
                <a onClick={() => createInputModifier(i.label, i.code, i.secret)}>修改</a>
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
