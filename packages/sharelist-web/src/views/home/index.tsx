import { ref, defineComponent, watch, reactive, toRef, computed, withModifiers } from 'vue'
import { useStore } from 'vuex'
import { Spin, Modal } from 'ant-design-vue'
import Icon from '@/components/icon'
import useDisk, { IFile } from '@/hooks/useDisk'
import './index.less'
import Header from './partial/header'
import { isSupportType, isAudioSupport, isVideoSupport } from '@/utils/format'
import MediaPlayer, { usePlayer } from '@/components/player'
import Breadcrumb from './partial/breadcrumb'
import Error from './partial/error'
import { useSetting } from '@/hooks/useSetting'
import { InfoCircleOutlined } from '@ant-design/icons-vue'

export default defineComponent({
  setup() {
    const { state } = useStore()

    const layout = toRef(state.setting, 'layout')

    const { loading, files, error, setPath, paths } = useDisk()

    const [mediaId, setMediaData] = usePlayer()

    const { loginState } = useSetting()

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

    const onShowInfo = (file: IFile) => {
      console.log(file)
      Modal.info({
        centered: true,
        title: file.name,
        content: <div>
          <div class="item">
            <div class="item__header">
              <div class="item__meta">
                <h4 class="item__meta-title">目录ID</h4>
                <div class="item__meta-desc" style="font-size:10px;color:rgba(0,0,0,.5);">{file.extra?.fid}</div>
              </div>
            </div>
          </div>
        </div>
      })
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
                  <a class="item" title={i.name} onClick={withModifiers(() => onClick(i), ['prevent'])}>
                    <Icon
                      class="item-icon"
                      style={{ fontSize: layout.value == 'grid' ? '42px' : '26px' }}
                      type={'icon-' + i.iconType}
                    />
                    {i.iconType == 'other' ? <div class={["item-icon__ext", i.ext.length > 7 ? 'item-icon__ext--sm' : i.ext.length > 4 ? 'item-icon__ext--md' : '']}>{i.ext}</div> : null}
                    <div class="item-meta">
                      <div class="item-name">{i.name}
                        {
                          loginState.value == 1 && i.iconType == 'folder' && i.extra?.fid ? <div class="item-info" onClick={withModifiers(() => onShowInfo(i), ['stop', 'prevent'])}><InfoCircleOutlined /></div> : null
                        }
                      </div>
                      <div class="item-ctime">{i.ctimeDisplay}</div>
                      <div class="item-size">{i.sizeDisplay}</div>
                    </div>
                  </a>
                )
              })}
            </Error>
          </div>
        </Spin >
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
      </div >
    )
  },
})
