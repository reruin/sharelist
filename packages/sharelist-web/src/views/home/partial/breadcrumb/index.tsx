import { ref, defineComponent, watch, onMounted, computed, watchEffect } from 'vue'
import Icon from '@/components/icon'
import { Breadcrumb } from 'ant-design-vue'
import useUrlState from '@/hooks/useUrlState'
import useDisk from '@/hooks/useDisk'

const { Item: BreadcrumbItem } = Breadcrumb
import './index.less'
export default defineComponent({
  setup(props, ctx) {
    const { paths, setPath } = useDisk()

    const onclick = (path: string, idx: number) => {
      if (idx < paths.value.length) {
        setPath({ path: paths.value.slice(0, idx).join('/') })
      }
    }

    return () => (
      <div class={['drive-routes' /*routes.value.length == 0 ? 'drive-routes--hidden' : null*/]}>
        <Breadcrumb separator=">">
          <BreadcrumbItem onClick={() => onclick('/', 0)}>
            <a>
              <Icon type="icon-home" />
            </a>
          </BreadcrumbItem>
          {paths.value.map((i: string, idx: number) => (
            <BreadcrumbItem onClick={() => onclick(i, idx + 1)}>
              <a>{i}</a>
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      </div>
    )
  },
})
