import { ref, defineComponent, watch, onMounted } from 'vue'
import './index.less'
import Icon from '@/components/icon'
import { useToggle, useTitle } from '@/hooks/useHooks'
// import Search from '../search'
import { Modal, InputSearch, RadioGroup, Radio, Space, Menu, Popover, Dropdown } from 'ant-design-vue'
import { useConfig } from '@/hooks/useSetting'
import useDisk from '@/hooks/useDisk'
import { ArrowDownOutlined, ArrowUpOutlined, SettingOutlined, CheckOutlined, SortDescendingOutlined, CalendarOutlined, FieldBinaryOutlined } from '@ant-design/icons-vue'
import useStore from '@/store/index'

export default defineComponent({
  setup() {
    const { config } = useConfig()

    const { diskConfig, setPath, current, sortConfig, setSort } = useDisk()

    const store = useStore()

    watch(() => config.title, (nv) => {
      if (document) {
        document.title = config.title
      }
    })

    const onToggleSearch = () => {
      const onSearch = (value: string) => {
        if (value) {
          // router.push({ path: router.currentRoute.value.path, query: { search: value } })
          setPath({ search: value, path: current.path, id: current.id })
          modal.destroy()
        }
      }


      const options: Array<any> = []

      if (diskConfig.globalSearch) {
        options.push({ label: '所有文件', value: 'global' })
      }
      if (diskConfig.localSearch) {
        options.push({ label: '当前目录', value: 'local' })
      }

      const searchType = ref(options[0]?.value)

      const modal = Modal.confirm({
        class: 'fix-modal--alone',
        width: '560px',
        maskClosable: true,
        content: () => (
          <div>
            <InputSearch enter-button placeholder="搜索内容" onSearch={onSearch} />
            {options.length ? <RadioGroup style="margin-top:8px;" options={options} value={searchType.value} onChange={(e) => searchType.value = e.target.value} name="radioGroup" ></RadioGroup> : null}
          </div>
        ),
      })
    }

    const navHome = () => setPath({ path: '/' })

    const onMenuAction = ({ key }: { key: any }) => {
      let [type, val] = key.split('.')
      if (type == 'layout') {
        store.setLayout(val)
      } else if (type == 'sort') {
        setSort(val)
      }
    }
    return () => (
      <div class="drive-header">

        <div onClick={navHome} class="drive-header__name">
          {config.title || 'sharelist'}
        </div>
        <div class="drive-action">
          {(diskConfig.value.globalSearch || diskConfig.value.localSearch) ? <Icon class="drive-action-search" type="icon-search" onClick={onToggleSearch} /> : null}

          <Dropdown overlayClassName='popover-padding-0 popover--narrow' placement="topRight" destroyTooltipOnHide={true} arrowPointAtCenter={true} trigger={['click']}>
            {{
              default: () => <span><SettingOutlined /></span>,
              overlay: () => <Menu class="menu-style" onClick={onMenuAction}>
                <Menu.ItemGroup title="视图">
                  <Menu.Item class="menu-item" key="layout.list">
                    <div class="flex flex--between"><div><Icon type={'icon-list'} style={{ fontSize: '18px', marginRight: '0px' }} /> 列表</div>{store.layout == 'list' ? <CheckOutlined /> : null}</div>
                  </Menu.Item>
                  <Menu.Item class="menu-item" key="layout.grid">
                    <div class="flex flex--between"><div><Icon type={'icon-grid'} style={{ fontSize: '18px', marginRight: '0px' }} /> 平铺</div>{store.layout == 'grid' ? <CheckOutlined /> : null}</div>
                  </Menu.Item>
                </Menu.ItemGroup>
                <Menu.ItemGroup title="排序">
                  <Menu.Item class="menu-item" key="sort.name"><div class="flex flex--between"><div><SortDescendingOutlined style={{ fontSize: '18px', marginRight: '8px' }} />名称</div>{sortConfig.value.key == 'name' ? (sortConfig.value.type == 'asc' ? <ArrowUpOutlined /> : <ArrowDownOutlined />) : null}</div></Menu.Item>
                  <Menu.Item class="menu-item flex" key="sort.mtime"><div class="flex flex--between"><div><CalendarOutlined style={{ fontSize: '18px', marginRight: '8px' }} />修改时间</div>{sortConfig.value.key == 'mtime' ? (sortConfig.value.type == 'asc' ? <ArrowUpOutlined /> : <ArrowDownOutlined />) : null}</div></Menu.Item>
                  <Menu.Item class="menu-item flex" key="sort.size"><div class="flex flex--between"><div><FieldBinaryOutlined style={{ fontSize: '18px', marginRight: '8px' }} />文件大小</div>{sortConfig.value.key == 'size' ? (sortConfig.value.type == 'asc' ? <ArrowUpOutlined /> : <ArrowDownOutlined />) : null}</div></Menu.Item>
                </Menu.ItemGroup>
              </Menu>
            }}
          </Dropdown>
        </div>
      </div>
    )
  },
})
