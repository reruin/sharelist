import { ref, defineComponent, reactive, onMounted, onUnmounted, computed, watchEffect, PropType, watch } from 'vue'
import Icon from '@/components/icon'
import { Breadcrumb, Popover, List } from 'ant-design-vue'
import { EllipsisOutlined } from '@ant-design/icons-vue'

import './index.less'
export default defineComponent({
  props: {
    paths: {
      type: Array as PropType<Array<string>>
    },
    size: {
      type: String,
      default: 'default'
    }
  },
  emit: ['tagClick'],
  setup(props, ctx) {

    const el = ref()

    const defaultClietHeight = ref(0)
    const lastClientWidth = ref(0)
    const onclick = (path: string, idx: number) => {
      ctx.emit('tagClick', { path, index: idx })
    }

    let ellipsisRange = ref(1)

    const onUpdate = () => {
      let { clientWidth, clientHeight } = el.value
      if (defaultClietHeight.value != clientHeight) {
        ellipsisRange.value++
        lastClientWidth.value = clientWidth
      }
    }

    let observer: ResizeObserver | null
    onMounted(() => {
      if (el.value) {
        if (!defaultClietHeight.value) {
          defaultClietHeight.value = el.value.clientHeight
        }
        observer = new ResizeObserver(entries => {
          onUpdate() // entries[0].contentRect
        })
        observer.observe(el.value)
      }
      window.addEventListener('resize', onUpdate)
    })

    onUnmounted(() => {
      observer?.disconnect()
      observer = null
      window.removeEventListener('resize', onUpdate)

    })

    watch(() => props.paths, (nv, ov) => {
      let nvl = nv?.length || 0
      let ovl = ov?.length || 0
      if (nvl < ovl) {
        ellipsisRange.value = 1
      }
      onUpdate()
    })

    const createItem = () => {
      const nodes = []
      const paths = props.paths || []
      if (paths.length == 0) return []

      nodes.push(
        <Breadcrumb.Item onClick={() => onclick(paths[0], 1)}>
          <a>{paths[0]}</a>
        </Breadcrumb.Item>
      )
      if (ellipsisRange.value > 1) {
        let dataSrc = paths.slice(1, 1 + ellipsisRange.value)
        nodes.push(
          <Breadcrumb.Item><Popover overlayClassName='popover-padding-0' overlayStyle={{ 'padding': '8px' }} placement="topRight" destroyTooltipOnHide={true} arrowPointAtCenter={true} trigger={['click']}>
            {{
              default: () => <EllipsisOutlined style={{ fontSize: '18px' }} />,
              content: () => <List data-source={dataSrc}>{{
                renderItem: ({ item, index }: { item: string, index: number }) => <List.Item onClick={() => onclick(item, ellipsisRange.value + index)} class="drive-breadcrumb-pop-item">{item}</List.Item>
              }}</List>
            }}
          </Popover></Breadcrumb.Item>
        )

        nodes.push(...paths.slice(1 + ellipsisRange.value).map((i, idx) => (
          <Breadcrumb.Item onClick={() => onclick(i, idx + 1 + ellipsisRange.value)}>
            <a>{i}</a>
          </Breadcrumb.Item>
        )))
      } else {
        nodes.push(...paths.slice(1).map((i, idx) => (
          <Breadcrumb.Item onClick={() => onclick(i, idx + 1 + 1)}>
            <a>{i}</a>
          </Breadcrumb.Item>
        )))
      }

      return nodes
    }
    return () => (
      <div ref={el} class={['drive-breadcrumb', 'drive-breadcrumb--' + props.size /*routes.value.length == 0 ? 'drive-routes--hidden' : null*/]}>
        <Breadcrumb separator=">">
          <Breadcrumb.Item onClick={() => onclick('', 0)}>
            <a>文件</a>
          </Breadcrumb.Item>
          {createItem()}
        </Breadcrumb>
      </div>
    )
  },
})
