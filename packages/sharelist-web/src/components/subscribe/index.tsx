import Qrcode from '../qrcode'
import { ref, defineComponent } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { AppleFilled } from '@ant-design/icons-vue'
import request from '@/utils/request'

//https://d3V0aW5nMDEyMkAxNjMuY29tOjA1NTkwNTU5QGtyLWEuaHVieS54eXo6NDQzMw?cert=&peer=#YL-SGP

export default defineComponent({
  setup() {
    const visible = ref(false)
    const url = ref('')
    const handleClick = async () => {
      visible.value = true
      const resp = await request.subscribe()
      if (resp.status) {
        message.error(resp.result)
      } else {
        url.value = resp.result.url
      }
    }

    const handleClose = () => {
      visible.value = false
    }

    return (
      <div class="subscribe">
        <a-button type="link" style="margin-left: 8px" on-click={handleClick}>
          <a-icon type="qrcode" style={{ fontSize: '16px' }} />
        </a-button>

        <Modal title="移动端订阅" centered={true} footer={null} on-cancel={handleClose} visible={visible.value}>
          <div style="text-align:center;">
            <Qrcode content={url} />
            <p style="margin-top:16px;">
              <AppleFilled style="color:#151517;margin-right:5px;font-size:15px;" />
              打开小火箭扫码订阅
            </p>
          </div>
        </Modal>
      </div>
    )
  },
})
