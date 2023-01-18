import { defineComponent, withModifiers, ref } from "vue";
import Icon from '@/components/icon'
import useDisk from '../useDisk'
import { Spin, Badge } from 'ant-design-vue'
import Error from '../error'
import './index.less'
import Breadcrumb from '../breadcrumb'

export const Meta = defineComponent({
  props: {

    data: {
      type: Object as PropType<IFile>
    },
    errorMode: {
      type: Boolean
    }
  },
  setup(props) {
    return () => <div class="file-meta">
      <div class="item-icon">
        {
          props.data?.thumb ?
            <div class="item-thumb" style={{ 'backgroundImage': `url(${props.data?.thumb})` }}></div>
            : [<Icon
              style={{ fontSize: '42px' }}
              type={'icon-' + props.data?.mediaType}
            />,
            props.data?.mediaType == 'file' && props.data?.ext.length <= 7 ? <div class="item-icon__ext">{props.data?.ext}</div> : null
            ]
        }
      </div>

      <div>
        <div class>{props.data?.name}</div>
        {
          props.errorMode ?
            <div class="flex item-desc">{props.data?.error}</div> :
            <div class="flex item-desc">
              {
                props.data?.ctimeDisplay ? <span>{props.data?.ctimeDisplay}</span> : null
              }
              {
                props.data?.size ? [<span class="item-dot"></span>, <span>{props.data?.sizeDisplay}</span>] : null
              }
            </div>
        }

      </div>
    </div>
  }
})

export const MetaLite = defineComponent({
  props: {
    data: {
      type: Object as PropType<IFile>
    },
  },
  setup(props) {
    return () => {
      let status = props.data?.status
      return <div class="file-meta">
        <Badge status={status == 0 ? 'default' : status == 1 ? 'processing' : status == 2 ? 'success' : status == 3 ? 'error' : 'default'} />
        <div class="item-icon item-icon--lite">
          <Icon
            style={{ fontSize: '36px' }}
            type={'icon-' + props.data?.mediaType}
          />
          {props.data?.mediaType == 'file' && props.data?.ext.length <= 7 ? <div class="item-icon__ext">{props.data?.ext}</div> : null}
        </div>

        <div>
          <div class>{props.data?.name}</div>
          {
            props.data?.error ?
              <div class="flex item-desc">{props.data?.error}</div> :
              <div class="flex item-desc">
                {
                  props.data?.ctimeDisplay ? [<span>{props.data?.ctimeDisplay}</span>, <span class="item-dot"></span>] : null
                }
                {
                  props.data?.size ? <span>{props.data?.sizeDisplay}</span> : null
                }
              </div>
          }

        </div>
      </div>
    }
  }
})
export const Tree = defineComponent({
  props: {
    dirMode: {
      type: Boolean
    },
    treeStyle: {
      type: Object
    },
    excludes: {
      type: Array
    }
  },
  emits: ['select'],
  setup(props, ctx) {
    const routeStacks = ref<Array<any>>([])

    const { loading, files, error, setPath, paths, loadMore, diskConfig, id, current, onUpdate } = useDisk({
      routeSlient: true,
      new: true,
      filter: (i: IFile) => {
        return (i.type == 'folder' || i.type == 'drive') && !props.excludes?.includes(i.id)
      }
    })

    const onSelect = (data: Partial<IFile>, append = false) => {

      let route: Partial<IFile> = {}

      if (append) {
        let lastPath = (routeStacks.value[routeStacks.value.length - 1]?.path || '')
        route.id = data.id
        route.path = `${lastPath == '/' ? '' : lastPath}` + '/' + data.name
        route.name = data.name
        routeStacks.value.push(route)
      } else {
        let idx = routeStacks.value.findIndex((i: IFile) => i.path == data.path)
        console.log(idx)
        // remote routeStacks
        if (idx < routeStacks.value.length - 1) {
          route = routeStacks.value[idx]
          routeStacks.value.splice(idx + 1)
        }
      }

      setPath(route)

      console.log(diskConfig.value)

      ctx.emit('select', route, data.config || diskConfig.value)
    }

    onUpdate(() => {
      if (diskConfig.isRoot) {
        console.log('disabled')
      }
    })

    const onTagClick = ({ path, index }: any = {}) => {
      console.log('tag', index)
      onSelect(routeStacks.value[index])
    }

    onSelect({ path: '', name: '' }, true)
    return () => (
      <div class="drive drive--lite">
        <div class="drive-header">
          <Breadcrumb onTagClick={onTagClick} size="sm" paths={routeStacks.value.slice(1).map((i: any) => i.name)} />
        </div>
        <div class="drive-body-wrap">

          <Spin delay={150} spinning={loading.value}>
            <Error value={error}>
              <div style={{ 'overflow': 'auto', 'height': '350px', ...(props.treeStyle || {}) }} class={['drive-body', 'drive-body--list']} >
                {files.value.map((i: IFile) => {
                  return (
                    <a class={["item", i.config?.readonly ? 'item--disabled' : null]} title={i.name} onClick={withModifiers(() => onSelect(i, true), ['prevent'])}>
                      <div class="item-icon">
                        {
                          i.thumb ?
                            <div class="item-thumb" style={{ 'backgroundImage': `url(${i.thumb})` }}></div>
                            : <Icon
                              style={{ fontSize: '36px' }}
                              type={'icon-' + i.mediaType}
                            />
                        }
                      </div>

                      <div class="item-meta">
                        <div class="item-name">{i.name}</div>
                      </div>
                    </a>
                  )
                })}
              </div>
            </Error>
          </Spin >
        </div>
      </div>
    )
  },
})
