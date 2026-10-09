<script setup lang="ts">
import { javascript } from "@codemirror/lang-javascript"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { computed, ref } from "vue"
import { Codemirror } from "vue-codemirror"
import { APP_BOOTSTRAP_CODE } from "../examples/app-bootstrap"

type Tab = "javascript" | "bootstrap"

const props = defineProps<{
  code: string
  title: string
  error: string
  running: boolean
}>()

const emit = defineEmits<{
  "update:code": [value: string]
  run: []
  restore: []
  copied: []
}>()

const extensions = [javascript(), oneDark]
const bootstrapExtensions = [
  javascript(),
  oneDark,
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
]

const tab = ref<Tab>("javascript")
const visibleCode = computed(() => {
  if (tab.value === "bootstrap") return APP_BOOTSTRAP_CODE
  return props.code
})
const editorExtensions = computed(() => {
  if (tab.value === "bootstrap") return bootstrapExtensions
  return extensions
})
const tabName = computed(() => {
  if (tab.value === "bootstrap") return "App 创建"
  return props.title
})

const onUpdate = (value: string) => {
  if (tab.value === "javascript") emit("update:code", value)
}

const copy = async () => {
  try {
    await navigator.clipboard.writeText(visibleCode.value)
    emit("copied")
  } catch {
    return
  }
}
</script>

<template>
  <section class="panel">
    <div class="tabs">
      <button
        class="tab"
        type="button"
        :class="{ on: tab === 'javascript' }"
        @click="tab = 'javascript'"
      >
        JavaScript
      </button>
      <button
        class="tab"
        type="button"
        :class="{ on: tab === 'bootstrap' }"
        @click="tab = 'bootstrap'"
      >
        公共代码
      </button>
      <span class="name">{{ tabName }}</span>
      <div class="tools">
        <button type="button" title="复制当前 tab 源码" @click="copy">复制</button>
        <button
          v-if="tab === 'javascript'"
          type="button"
          title="把编辑器恢复为当前示例的原始源码"
          @click="emit('restore')"
        >
          还原
        </button>
        <button
          v-if="tab === 'javascript'"
          class="run"
          type="button"
          :disabled="running"
          @click="emit('run')"
        >
          运行
        </button>
      </div>
    </div>
    <p v-if="tab === 'bootstrap'" class="hint">
      每次运行都会先执行这段公共创建代码，再执行 JavaScript。示例里的 app 就是这里创建的 Arc3DApp。gui 用来在地球左上角创建按钮、开关和下拉菜单。
    </p>
    <p v-if="error && tab === 'javascript'" class="err">{{ error }}</p>
    <Codemirror
      :key="tab"
      :model-value="visibleCode"
      :extensions="editorExtensions"
      :tab-size="2"
      class="editor"
      @update:model-value="onUpdate"
    />
  </section>
</template>

<style scoped lang="scss">
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #242526;
  color: #d7dbe0;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
}

.tabs {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 6px;
  background: #303336;
  border-bottom: 1px solid #1a1c1e;
  gap: 4px;
}

.tab {
  height: 24px;
  padding: 0 8px;
  border-radius: 3px 3px 0 0;
  font-size: 12px;
  line-height: 24px;
  color: #9aa0a6;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.tab.on {
  background: #1f2124;
  color: #e8c547;
}

.name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #9aa0a6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tools {
  margin-left: auto;
  display: flex;
  flex-shrink: 0;
  gap: 6px;

  button {
    height: 22px;
    border: 1px solid #4a4e53;
    background: #3a3e42;
    color: #fff;
    border-radius: 3px;
    padding: 0 8px;
    font-size: 12px;
    cursor: pointer;
  }

  .run {
    background: #c9a227;
    border-color: #8a7320;
    color: #1b1404;
    font-weight: 700;
  }
}

.err {
  margin: 0;
  padding: 6px 10px;
  background: #4a1c1c;
  color: #ffccc7;
  font-size: 12px;
}

.hint {
  margin: 0;
  padding: 6px 10px;
  background: #1f2124;
  color: #9aa0a6;
  font-size: 12px;
  line-height: 1.45;
}

.editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.editor :deep(.cm-editor) {
  height: 100%;
  font-size: 13px;
}

.editor :deep(.cm-scroller) {
  font-family: "Consolas", "IBM Plex Mono", monospace;
}
</style>
