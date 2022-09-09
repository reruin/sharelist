import { ref, defineComponent, watch, onMounted } from 'vue'
import { InputSearch, RadioGroup, Radio } from 'ant-design-vue'
import './index.less'
import useDisk from '../useDisk'

export default defineComponent({
  emits: ['search'],
  setup(props, ctx) {
    const { diskConfig, setQuery } = useDisk()

    const onSearch = (value: string) => {
      if (value) {
        // router.push({ path: router.currentRoute.value.path, query: { search: value } })
        setQuery({ search: value })
        ctx.emit('search')
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
    return () => <>
      <InputSearch enter-button placeholder="搜索内容" onSearch={onSearch} />
      {options.length ? <RadioGroup style="margin-top:8px;" options={options} value={searchType.value} onChange={(e) => searchType.value = e.target.value} name="radioGroup" ></RadioGroup> : null}
    </>
  },
})
