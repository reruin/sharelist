import { ref, defineComponent, watch, onMounted } from 'vue'
import Icon from '@/components/icon'
import { useStore } from 'vuex'
import { Modal, InputSearch } from 'ant-design-vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import './index.less'
export default defineComponent({
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, ctx) {
    const visible = ref(false)
    const key = ref('')

    const setModalVisible = () => {
      visible.value = false
    }

    const onSearch = () => { }
    return () => <InputSearch v-model={[key.value, 'value']} placeholder="搜索内容" onSearch={onSearch} />
  },
})
