import { defineComponent } from "vue";

export default defineComponent({
  setup() {
    return () => <div class="modal">
      <div class="modal__header">跨盘复制</div>
      <div class="modal__body"></div>
    </div>
  }
})