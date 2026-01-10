<script setup lang="ts">
import * as Arc3DLab from "arc3dlab"
import { nextTick, onMounted } from "vue"
let viewer: Arc3DLab.Viewer
onMounted(() => {
  console.log("mounted", Arc3DLab)
  nextTick(() => {
    viewer = new Arc3DLab.Viewer("cus-map")
    window.viewer = viewer
    window.Arc3DLab = Arc3DLab
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
