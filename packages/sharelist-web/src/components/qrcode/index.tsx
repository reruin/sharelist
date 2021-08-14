import QRCode from 'qrcode'
import { watchEffect, defineComponent, render } from 'vue'
export default defineComponent({
  name: 'SlQrcode',

  props: {
    content: {
      type: String,
      default: '',
    },
    width: {
      type: Number,
      default: 200,
    },
    height: {
      type: Number,
      default: 200,
    },
    margin: {
      type: Number,
      default: 0,
    },
    transparent: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const render = () => {
      const options = {
        margin: props.margin,
        width: props.width,
        height: props.height,
      }

      if (props.transparent) {
        options.color = {
          light: '#0000', // Transparent background
        }
      }

      QRCode.toCanvas(this.$el, this.content, options, (err, data) => {
        if (err) throw err
      })
    }

    watchEffect(() => {
      if (props.content) {
        render(props.content)
      }
    })

    return <canvas></canvas>
  },
})
