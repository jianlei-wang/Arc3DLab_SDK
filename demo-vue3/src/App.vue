<script setup lang="ts">
import { Viewer } from "arc3dlab"
import { nextTick, onMounted } from "vue"
let viewer: Viewer
onMounted(() => {
  nextTick(() => {
    viewer = new Viewer("cus-map")
  })
})
</script>

<template>
  <div id="cus-map"></div>
</template>

<style scoped lang="scss">
#cus-map {
  width: 100%;
  height: 100%;
}
</style>
