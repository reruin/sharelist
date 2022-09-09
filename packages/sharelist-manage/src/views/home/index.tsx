import Sider from '../../components/sider'
import { RouterView } from 'vue-router'
import { defineComponent } from 'vue'
import { useSetting } from '@/hooks/useSetting'
import Signin from '../signin'

import './index.less'
import MediaPlayer, { usePlayer } from '@/components/player'

export default defineComponent({

  setup() {
    const { loginState } = useSetting()
    const { id } = usePlayer('player')

    return () => (
      loginState.value == 1 ?
        <div class="layout">
          <div class="layout__sider"><Sider /></div>
          <div class="layout__content"><RouterView /></div>
          <div class="widget">
            <MediaPlayer meidaId={id} />
          </div>
        </div> : loginState.value == 2 ?
          <Signin />
          : null
    )
  }
})