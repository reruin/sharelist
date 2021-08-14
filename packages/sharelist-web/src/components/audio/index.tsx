import { ref, defineComponent, onMounted, computed } from 'vue'
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons-vue'
import './index.less'
import APlayer from 'aplayer'
import 'aplayer/dist/APlayer.min.css'
export default defineComponent({
  props: {
    src: {
      type: String,
      default: '',
    },
  },
  emits: ['loaded'],
  setup(props, ctx) {
    const el = ref()
    const visible = ref(false)
    let player: any
    const onAdd = () => {
      visible.value = true
    }

    const onClose = () => {
      player.pause()
      visible.value = false
    }
    onMounted(() => {
      player = new APlayer({
        container: el.value,
        fixed: true,
        // theme: '#000000',
      })

      player.on('listadd', onAdd)
      ctx.emit('loaded', player)
    })

    return () => (
      <div class={['widget-audio', visible.value ? 'widget-audio--visible' : null]}>
        <div ref={el}></div>
        <div onClick={onClose} class="widget-close">
          ×
        </div>
      </div>
    )
  },
})
