import { VNode, withDirectives } from 'vue'

const focus = {
  mounted: (el: any, { arg }: any) => {
    el.focus()
    if (arg == 'select') {
      el.select()
    }
  },
}

const select = {
  mounted: (el: any) => {
    el.select()
  },
}

export const useFocus = (node: VNode, select = false): VNode =>
  withDirectives(node, [[focus, true, select ? 'select' : '']])
