import { ref, defineComponent, watch, onMounted, toRef, toRefs, reactive } from 'vue'
import { RadioGroup, Radio, message } from 'ant-design-vue'
import { SaveOutlined, ImportOutlined } from '@ant-design/icons-vue'
import { useSetting, ConfigFieldItem } from '@/hooks/useSetting'
import { Switch, Modal, Input, InputNumber, Alert, Tabs } from 'ant-design-vue'
import './index.less'

const { TextArea } = Input
const valueDisplay = (value: any, type: string) => {
  if (type == 'boolean') {
    return Boolean(value) ? '启用' : '禁用'
  }
  else if (type == 'array') {
    const len = value.length
    const nodes = value.slice(0, 3).map((i: string) => <div>{i}</div>)
    if (len > 3) {
      nodes.push(<div>等{len}项</div>)
    }
    return nodes
  }
  else if (type == 'textarea') {
    return value ? '已设置' : '未设置'
  } else {
    return value
  }
}

export default defineComponent({
  setup() {

    const { config, setConfig, exportConfig, configFields } = useSetting()

    const readFile = (e: any) => {
      var reader = new FileReader(); //这是核心,读取操作就是由它完成.
      reader.readAsText(e.target.files[0]); //读取文件的内容,也可以读取文件的URL
      reader.onload = function () {
        //当读取完成后回调这个函数,然后此时文件的内容存储到了result中,直接操作即可
        try {
          let data = JSON.parse(reader.result as string)
          setConfig(data)
        } catch (e) {
          message.error('无法读取到配置信息')
        }
      }
    }

    const createInputModifier = ({ label, code, secret, type, help, handler }: ConfigFieldItem) => {
      const modifier = ref(secret ? '' : config[code])
      const handleChange = (e: any) => modifier.value = e.target.value
      const handleChangeValue = (e: unknown) => modifier.value = e as number

      let lastVal = modifier.value
      //modal 下的input v-model 有bug
      Modal.confirm({
        title: label,
        class: 'pure-modal',
        content: (
          <div>
            {
              help ? <Alert message={help} type="info" show-icon style="font-size:12px;margin-bottom:8px;" /> : null
            }
            {
              type == 'number' ?
                <InputNumber defaultValue={modifier.value} onChange={handleChangeValue} style="width:100%;" placeholder="请输入" /> :
                <TextArea defaultValue={modifier.value} onChange={handleChange} placeholder="请输入" />
            }

          </div>
        ),
        onOk: () => {
          setConfig({ [code]: modifier.value })
          handler?.(modifier.value, lastVal)
        },
      })
    }

    const createListModifier = (label: string, code: string) => {
      const modifier = ref(config[code].join('\n'))
      const handleChange = (e: any) => modifier.value = e.target.value

      Modal.confirm({
        title: label,
        class: 'pure-modal',
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

    const createOptionModifier = (label: string, code: string) => {
      console.log(label, code, config[code])
      const modifier = ref(config[code])
      const handleChange = (e: any) => {
        modifier.value = e.target.value
      }
      const options = config[`${code}_options`]
      Modal.confirm({
        title: label,
        class: 'pure-modal',
        content: () => (
          <div>
            <RadioGroup value={modifier.value} onChange={handleChange}>
              {
                options.map((i: any) => <Radio style={{ display: 'block' }} value={i}>{i}</Radio>)
              }
            </RadioGroup>
          </div>
        ),
        onOk: () => {
          setConfig({ [code]: modifier.value })
        },
      })
    }

    return () => (
      <div class="page page--setting">
        <div class="page__header">
          <div>设置</div>
          <div class="page__action">
            <div style="display:flex;align-items:center;">
              <a style="cursor:pointer;font-size:12px;color:#666;" title="保存配置 / Save config" onClick={exportConfig} ><SaveOutlined style={{ fontSize: '15px', 'marginRight': '4px' }} />导出</a>
              <a style="cursor:pointer;font-size:12px;color:#666;margin-left:12px;position:relative;" title="导入配置 / Import config"><ImportOutlined style={{ fontSize: '15px', 'marginRight': '4px' }} />导入<input type="file" style="opacity:0;position:absolute;top:0;left:0;width:100%;height:100%;" name="file" id="file" onChange={readFile} /></a>
            </div>
          </div>
        </div>
        <div class="setting__body">
          <Tabs >
            {
              configFields.value.map((i, idx) => <Tabs.TabPane key={idx}>
                {{
                  default: () => i.children.map((i) => (
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
                        ) : i.type == 'string' || i.type == 'textarea' ? (
                          <a onClick={() => createInputModifier(i)}>修改</a>
                        ) : i.type == 'number' ? (
                          <a onClick={() => createInputModifier(i)}>修改</a>
                        ) : i.type == 'array' ? (
                          <a onClick={() => createListModifier(i.label, i.code)}>修改</a>
                        ) : i.type == 'option' ? (
                          <a onClick={() => createOptionModifier(i.label, i.code)}>修改</a>
                        ) : null}
                      </div>
                    </div>
                  )),
                  tab: () => (
                    <span>{i.title}</span>
                  ),
                }}
              </Tabs.TabPane>)
            }
          </Tabs>
        </div>
      </div>
    )
  },
})
