<script setup lang="ts">
import type { Arc3DApp } from "arc3dlab"
import { computed, onMounted, onUnmounted, ref } from "vue"
import CodePanel from "./components/CodePanel.vue"
import ExampleGallery from "./components/ExampleGallery.vue"
import SandcastleHeader from "./components/SandcastleHeader.vue"
import StatusToast from "./components/StatusToast.vue"
import { examples, findExample } from "./examples/catalog"
import { GLOBE_CONTAINER_ID } from "./examples/app-bootstrap"
import { runSandcastleCode } from "./runner"

const GLOBE_ID = GLOBE_CONTAINER_ID
const currentId = ref("hello-world")
const current = computed(() => findExample(currentId.value))
const code = ref(current.value.code)
const query = ref("")
const galleryOpen = ref(false)
const running = ref(false)
const error = ref("")
const editorWidth = ref(420)
let app: Arc3DApp | undefined
let dragStart = 0
let dragWidth = 0
let toastTimer = 0
const toast = ref("")

const notify = (message: string) => {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ""
  }, 1800)
}

const resizeGlobe = () => {
  requestAnimationFrame(() => {
    const viewer = app?.native.viewer as { resize?: () => void } | undefined
    viewer?.resize?.()
  })
}

const run = async () => {
  if (running.value) return
  running.value = true
  error.value = ""
  galleryOpen.value = false
  try {
    app = await runSandcastleCode({
      container: GLOBE_ID,
      previous: app,
      code: code.value,
    })
    resizeGlobe()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    running.value = false
  }
}

const selectExample = async (id: string) => {
  currentId.value = id
  code.value = findExample(id).code
  galleryOpen.value = false
  await run()
}

const resetExample = async () => {
  code.value = current.value.code
  await run()
  if (!error.value) notify("已重置并重新运行")
}

const restoreExample = () => {
  code.value = current.value.code
  notify("已还原为示例源码")
}

const onQuery = (value: string) => {
  query.value = value
  if (!galleryOpen.value) galleryOpen.value = true
}

const startResize = (event: PointerEvent) => {
  dragStart = event.clientX
  dragWidth = editorWidth.value
  window.addEventListener("pointermove", onResize)
  window.addEventListener("pointerup", stopResize)
}

const onResize = (event: PointerEvent) => {
  const max = Math.max(320, window.innerWidth - 360)
  editorWidth.value = Math.min(Math.max(dragWidth + (event.clientX - dragStart), 280), max)
}

const stopResize = () => {
  window.removeEventListener("pointermove", onResize)
  window.removeEventListener("pointerup", stopResize)
  resizeGlobe()
}

onMounted(() => {
  window.addEventListener("resize", resizeGlobe)
  void run()
})

onUnmounted(() => {
  window.removeEventListener("resize", resizeGlobe)
  stopResize()
  window.clearTimeout(toastTimer)
  void app?.destroy()
})
</script>

<template>
  <div class="shell">
    <SandcastleHeader
      :gallery-open="galleryOpen"
      :query="query"
      :running="running"
      @toggle-gallery="galleryOpen = !galleryOpen"
      @update:query="onQuery"
      @run="run"
      @reset="resetExample"
    />

    <div class="workspace">
      <div class="dock" :style="{ width: `${editorWidth}px` }">
        <CodePanel
          :code="code"
          :title="current.title"
          :error="error"
          :running="running"
          @update:code="code = $event"
          @run="run"
          @restore="restoreExample"
          @copied="notify('已复制到剪贴板')"
        />
      </div>

      <div class="split" @pointerdown="startResize" />

      <main class="stage">
        <div :id="GLOBE_ID" class="globe" />
        <ExampleGallery
          v-if="galleryOpen"
          :examples="examples"
          :active-id="currentId"
          :query="query"
          @select="selectExample"
        />
      </main>
    </div>
    <StatusToast v-if="toast" :message="toast" />
  </div>
</template>

<style scoped lang="scss">
.shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #000;
  position: relative;
}

.workspace {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.dock {
  flex: 0 0 auto;
  min-width: 280px;
  height: 100%;
}

.split {
  width: 6px;
  flex: 0 0 6px;
  cursor: ew-resize;
  background: #1a1c1e;
  border-left: 1px solid #4a4e53;
  border-right: 1px solid #111;
}

.split:hover {
  background: #e8c547;
}

.stage {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.globe {
  width: 100%;
  height: 100%;
}
</style>
