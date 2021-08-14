import { computed, defineComponent, PropType, inject } from 'vue'
import UserMenu from '../user-menu'
import HintBar from '../hintbar'
import SwitchMode from '../switch-mode'
import Subscribe from '../subscribe'

import './index.less'

export default defineComponent({
  setup() {
    return (
      <div class="content-header">
        <HintBar class="content-header-fixed" />
        <div class="content-header-body">
          <UserMenu />
          <div style="display:flex;align-items:center;">
            <Subscribe />
          </div>
        </div>
      </div>
    )
  },
})
