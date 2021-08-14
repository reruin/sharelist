import { createFromIconfontCN } from '@ant-design/icons-vue'
import config from '../../config/setting'

const IconFont = createFromIconfontCN({
  scriptUrl: config.iconFontCN,
})

export default IconFont
