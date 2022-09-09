import './index.less'
import { ref, defineComponent, watch, onMounted, onUnmounted, toRefs, reactive, watchEffect } from 'vue'
import { javascript } from "@codemirror/lang-javascript"
import { EditorState, EditorView, basicSetup } from "@codemirror/basic-setup"

export default defineComponent({
  emits: ['update'],
  props: {
    defaultValue: {
      type: String,
    }
  },
  setup(props, ctx) {
    const el = ref()

    const updateListenerExtension = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // Handle the event here
        ctx.emit('update', update.state.doc.toString())
      }
    });
    let startState = EditorState.create({
      doc: props.defaultValue,
      extensions: [basicSetup, javascript(), updateListenerExtension]
    })

    let view
    onMounted(() => {
      view = new EditorView({
        state: startState,
        parent: el.value
      })
    })

    onUnmounted(() => {

    })
    return () => <div ref={el}></div>
  }
})