import { onMounted, onUnmounted, defineComponent, ref, reactive, toRef, watch, withModifiers } from 'vue'
import { Spin, Modal } from 'ant-design-vue'
import Icon from '@/components/icon'
import useDisk, { IFile } from '@/hooks/useDisk'
import './index.less'
import Header from './partial/header'
import { isMediaSupport } from '@/utils/format'
import MediaPlayer, { usePlayer } from '@/components/player'
import Breadcrumb from './partial/breadcrumb'
import Error from './partial/error'
import { InfoCircleOutlined, GithubOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import { useConfig } from '@/hooks/useSetting'
import { useScroll } from '@/hooks/useScroll'
import { useRoute } from 'vue-router'
import useStore from '@/store/index'
import { showImage } from '@/components/image'

export default defineComponent({
  setup() {
    const state = useStore()

    const { config } = useConfig()

    const { loading, files, error, setPath, paths, loadMore, diskConfig, current: currentDisk, setAuth, setSort, sortConfig } = useDisk()

    const { id: mediaId, setPlayer } = usePlayer('player')

    const route = useRoute()

    const { scrollTo, setNode, cancel: cancelScroll, isScroll } = useScroll(loadMore)

    const driveEl = ref()

    onMounted(() => {
      setNode(driveEl.value)
    })

    onUnmounted(() => {
      cancelScroll?.()
    })


    const onTagClick = ({ path, index }: any = {}) => {
      if (path == '/') {
        setPath({ path: '/' })
      } else if (index < paths.value.length) {
        setPath({ path: '/' + paths.value.slice(0, index).join('/') })
      }
    }


    const onClick = (data: IFile) => {
      if (data.type == 'folder' || data.type == 'drive') {
        let target: any = {
          id: data.id
        }

        if (!data.path && !currentDisk.search) {
          target.path = (currentDisk.path || '') + '/' + data.name
        }
        setPath(target)
      } else if (data.type == 'file') {
        let mediaType = data.mediaType
        if ((data.mediaType == 'audio' || data.mediaType == 'video') && isMediaSupport(data.name, mediaType)) {

          const list: Array<IFile> = files.value.filter((i: IFile) => isMediaSupport(i.name, mediaType))
          setPlayer({
            list,
            type: mediaType,
            index: list.findIndex((i: IFile) => i.id == data.id),
          })

        }
        else if (data.mediaType == 'image') {
          const list: Array<IFile> =
            files.value.filter((i: IFile) => isMediaSupport(i.name, 'image'))

          showImage(list.map(i => i.download_url), list.findIndex(i => i.id == data.id))

        }
        else {
          window.open(data.download_url)
        }
      }
    }


    watch(
      route,
      (nv) => {
        let target: any = {
          path: '/' + route.params.path as string
        }
        if (route.query.search) {
          target.search = route.query.search
        }
        setPath(target)
        scrollTo(0)
      },
      { immediate: true },
    )

    return () => (
      [<div class="layout app-light" ref={driveEl}>
        <Header />
        <Breadcrumb onTagClick={onTagClick} paths={paths.value} />
        <Spin spinning={loading.value} >
          <Error value={error} onAuth={setAuth}>
            {
              <div class={['drive-body', 'drive-body--' + state.layout]} >

                {files.value.map((i: IFile) => {
                  return (
                    <a class="item" href={paths.value.join('/') + '/' + i.name + '?download'} title={i.name} onClick={withModifiers(() => onClick(i), ['prevent'])}>

                      <div class="item-icon">
                        {
                          i.thumb ?
                            <div class="item-thumb" style={{ 'backgroundImage': `url(${i.thumb})` }}></div>
                            : [<Icon
                              style={{ fontSize: state.layout == 'grid' ? '64px' : '36px' }}
                              type={'icon-' + i.mediaType}
                            />,
                            i.mediaType == 'file' ? <div class={["item-icon__ext", i.ext.length > 7 ? 'item-icon__ext--sm' : i.ext.length > 4 ? 'item-icon__ext--md' : '']}>{i.ext}</div> : null
                            ]
                        }
                      </div>

                      <div class="item-meta">
                        <div class="item-name">{i.name}</div>
                        <div class="item-ctime">{i.ctimeDisplay}</div>
                        <div class="item-size">{i.sizeDisplay}</div>
                      </div>

                    </a>
                  )
                })}
              </div>
            }
          </Error>
        </Spin >
        <div class="widget">
          <MediaPlayer meidaId={mediaId} />
        </div>
      </div>,
      <footer>
        <p>
          <a href="https://github.com/reruin/sharelist" target="_blank">
            <GithubOutlined style="margin-right:8px;" />GitHub
          </a>
        </p>
      </footer>]
    )
  },
})
