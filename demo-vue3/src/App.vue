<script setup lang="ts">
import type { Arc3DApp } from "arc3dlab"
import { computed, onMounted, onUnmounted, ref } from "vue"
import CodePanel from "./components/CodePanel.vue"
import ConsolePanel, { type ConsoleLine } from "./components/ConsolePanel.vue"
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
const consoleHeight = ref(160)
const consoleCollapsed = ref(false)
const consoleLines = ref<ConsoleLine[]>([])
const guiHost = ref<HTMLElement | null>(null)
let app: Arc3DApp | undefined
let dragStart = 0
let dragWidth = 0
let consoleDragStart = 0
let consoleDragHeight = 0
let toastTimer = 0
let consoleSeq = 0
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
  consoleLines.value = []
  try {
    app = await runSandcastleCode({
      container: GLOBE_ID,
      previous: app,
      code: code.value,
      guiHost: guiHost.value,
      onConsole: (level, text) => {
        consoleSeq += 1
        consoleLines.value.push({ id: consoleSeq, level, text })
      },
    })
    resizeGlobe()
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    error.value = message
    consoleSeq += 1
    consoleLines.value.push({ id: consoleSeq, level: "error", text: message })
  } finally {
    running.value = false
  }
}

const selectExample = async (id: string) => {
  currentId.value = id
  const example = findExample(id)
  code.value = example.code
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

const startConsoleResize = (event: PointerEvent) => {
  consoleDragStart = event.clientY
  consoleDragHeight = consoleHeight.value
  consoleCollapsed.value = false
  window.addEventListener("pointermove", onConsoleResize)
  window.addEventListener("pointerup", stopConsoleResize)
}

const onConsoleResize = (event: PointerEvent) => {
  const max = Math.max(120, window.innerHeight - 220)
  consoleHeight.value = Math.min(
    Math.max(consoleDragHeight + (consoleDragStart - event.clientY), 80),
    max
  )
}

const stopConsoleResize = () => {
  window.removeEventListener("pointermove", onConsoleResize)
  window.removeEventListener("pointerup", stopConsoleResize)
  resizeGlobe()
}

onMounted(() => {
  window.addEventListener("resize", resizeGlobe)
  void run()
})

onUnmounted(() => {
  window.removeEventListener("resize", resizeGlobe)
  stopResize()
  stopConsoleResize()
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
        <div class="code-wrap">
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
        <div class="vsplit" @pointerdown="startConsoleResize" />
        <div
          class="console-wrap"
          :style="{ height: consoleCollapsed ? '28px' : `${consoleHeight}px` }"
        >
          <ConsolePanel
            :lines="consoleLines"
            :collapsed="consoleCollapsed"
            @clear="consoleLines = []"
            @toggle="consoleCollapsed = !consoleCollapsed"
          />
        </div>
      </div>

      <div class="split" @pointerdown="startResize" />

      <main class="stage">
        <div :id="GLOBE_ID" class="globe" />
        <div ref="guiHost" class="gui-host" />
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
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-width: 280px;
  height: 100%;
}

.code-wrap {
  flex: 1 1 auto;
  min-height: 0;
}

.vsplit {
  height: 6px;
  flex: 0 0 6px;
  cursor: ns-resize;
  background: #1a1c1e;
  border-top: 1px solid #4a4e53;
  border-bottom: 1px solid #111;
}

.vsplit:hover {
  background: #e8c547;
}

.console-wrap {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-height: 28px;
  overflow: hidden;
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

.gui-host {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 3;
  pointer-events: auto;
  max-width: min(420px, 52%);
  color: #fff;
  font: 13px/1.4 "Trebuchet MS", "Segoe UI", sans-serif;
  text-shadow: 0 1px 2px #000;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(36, 37, 38, 0.86);
  border: 1px solid #4a4e53;
  border-radius: 4px;
}

.gui-host:empty {
  display: none;
}

.gui-host :deep(*) {
  pointer-events: auto;
}

.gui-host :deep(button),
.gui-host :deep(select) {
  height: 24px;
  padding: 0 8px;
  border: 1px solid #4a4e53;
  background: #3a3e42;
  color: #fff;
  border-radius: 3px;
  font: 12px "Trebuchet MS", "Segoe UI", sans-serif;
  cursor: pointer;
}

.gui-host :deep(.gui-toggle) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #4a4e53;
  background: #3a3e42;
  border-radius: 3px;
  color: #fff;
  font: 12px "Trebuchet MS", "Segoe UI", sans-serif;
  cursor: pointer;
}
</style>
