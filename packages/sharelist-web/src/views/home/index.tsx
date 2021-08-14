import { ref, defineComponent, watch, reactive, toRef, computed } from 'vue'
import { useStore } from 'vuex'
import { Spin } from 'ant-design-vue'
import Icon from '@/components/icon'
import useDisk, { IFile } from '@/hooks/useDisk'
import './index.less'
import Header from './partial/header'
import { isSupportType, isAudioSupport, isVideoSupport } from '@/utils/format'
import MediaPlayer, { usePlayer } from '@/components/player'
import Breadcrumb from './partial/breadcrumb'
import Error from './partial/error'

export default defineComponent({
  setup() {
    const { state } = useStore()

    const layout = toRef(state.setting, 'layout')

    const { loading, files, error, setPath, paths } = useDisk()

    const [mediaId, setMediaData] = usePlayer()

    const onClick = (data: IFile) => {
      if (data.type == 'folder') {
        setPath(data)
      } else if (data.type == 'file') {
        const type = isSupportType(data.name)
        if (type && (type == 'audio' || type == 'video')) {
          const list: Array<IFile> =
            type == 'audio'
              ? files.value.filter((i: IFile) => isAudioSupport(i.name))
              : files.value.filter((i: IFile) => isVideoSupport(i.name))
          setMediaData({
            list,
            type,
            index: list.findIndex((i: IFile) => i.id == data.id),
          })
        } else {
          window.open(data.download_url)
        }
      }
    }

    return () => (
      <div class="layout app-light">
        <Header />
        <Breadcrumb paths={paths.value} />
        <Spin spinning={loading.value}>
          <div class={['drive-body', 'drive-body--' + layout.value]}>
            <Error value={error}>
              {files.value.map((i: IFile) => {
                return (
                  <div class="item" title={i.name} onClick={() => onClick(i)}>
                    <Icon
                      class="item-icon"
                      style={{ fontSize: layout.value == 'grid' ? '42px' : '26px' }}
                      type={'icon-' + i.iconType}
                    />
                    <div class="item-meta">
                      <div class="item-name">{i.name}</div>
                      <div class="item-ctime">{i.ctimeDisplay}</div>
                      <div class="item-size">{i.sizeDisplay}</div>
                    </div>
                  </div>
                )
              })}
            </Error>
          </div>
        </Spin>
        <div class="widget">
          <MediaPlayer meidaId={mediaId} />
        </div>
        <footer>
          <p>
            <a href="https://github.com/reruin/sharelist" target="_blank">
              GitHub
            </a>
            <a href="/@manage" target="_blank">
              管理
            </a>
          </p>
        </footer>
      </div>
    )
  },
})
