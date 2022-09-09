<template>
  <h1>Home</h1>
  <nav><router-link to="/plugin">plugin</router-link> |</nav>
</template>

<script lang="ts">
import { ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { RouterLink } from 'vue-router'
export default {
  setup() {
    const promptExit = ref(true)
    onBeforeRouteLeave((to, from, next) => {
      console.log(to)
      next()
    })

    return { promptExit }
  },
}
</script>
