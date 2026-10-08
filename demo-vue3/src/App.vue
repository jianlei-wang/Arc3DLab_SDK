<script setup lang="ts">
import { Arc3D, type Arc3DApp } from "arc3dlab"
import { onMounted, onUnmounted } from "vue"

let app: Arc3DApp | undefined
onMounted(() => {
  Arc3D.create({ container: "cus-map" }).then((instance) => {
    app = instance
    window.app = instance
  })
})
onUnmounted(() => {
  app?.destroy()
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
