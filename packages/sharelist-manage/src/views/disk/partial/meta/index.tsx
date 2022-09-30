import { defineComponent, PropType, StyleValue, withModifiers } from "vue";
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
    'dirMode': {
      type: Boolean
    },
    'treeStyle': {
      type: Object
    }
  },
  emits: ['select'],
  setup(props, ctx) {

    const { loading, files, error, setPath, paths, loadMore, diskConfig, id, current } = useDisk({
      routeSlient: true,
      new: true,
      filter: (i: IFile) => {
        return i.type == 'folder' || i.type == 'drive'
      }
    })

    const onSelect = (data: IFile) => {

      if (!data.path) {
        data.path = (current.path || '') + '/' + data.name
      }
      setPath(data)

      ctx.emit('select', data)
    }

    const onTagClick = ({ path, index }: any = {}) => {
      if (path == '/') {
        setPath({ path: '/' })
      } else if (index < paths.value.length) {
        setPath({ path: '/' + paths.value.slice(0, index).join('/') })
      }
    }

    setPath({ path: '' })
    return () => (
      <div class="drive drive--lite">
        <div class="drive-header">
          <Breadcrumb onTagClick={onTagClick} size="sm" paths={paths.value} />
        </div>
        <div class="drive-body-wrap">

          <Spin delay={150} spinning={loading.value}>
            <Error value={error}>
              <div style={{ 'overflow': 'auto', 'height': '350px', ...(props.treeStyle || {}) }} class={['drive-body', 'drive-body--list']} >
                {files.value.map((i: IFile) => {
                  return (
                    <a class="item" title={i.name} onClick={withModifiers(() => onSelect(i), ['prevent'])}>
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