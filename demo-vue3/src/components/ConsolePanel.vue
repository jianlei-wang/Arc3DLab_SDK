<script setup lang="ts">
import { nextTick, ref, watch } from "vue"

export interface ConsoleLine {
  id: number
  level: "log" | "info" | "warn" | "error"
  text: string
}

const props = defineProps<{
  lines: ConsoleLine[]
  collapsed: boolean
}>()

const emit = defineEmits<{
  clear: []
  toggle: []
}>()

const scroller = ref<HTMLElement | null>(null)

watch(
  () => props.lines.length,
  async () => {
    if (props.collapsed) return
    await nextTick()
    const el = scroller.value
    if (el) el.scrollTop = el.scrollHeight
  }
)
</script>

<template>
  <section class="console" :class="{ collapsed }">
    <div class="bar">
      <button class="toggle" type="button" @click="emit('toggle')">
        控制台
        <span class="count">{{ lines.length }}</span>
      </button>
      <button type="button" :disabled="!lines.length" @click="emit('clear')">清空</button>
    </div>
    <ol v-if="!collapsed" ref="scroller" class="log">
      <li v-if="!lines.length" class="empty">运行示例后，console 输出会显示在这里。</li>
      <li v-for="line in lines" :key="line.id" :class="line.level">
        <span class="lvl">{{ line.level }}</span>
        <span class="msg">{{ line.text }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped lang="scss">
.console {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #1b1d1f;
  color: #d7dbe0;
  border-top: 1px solid #111;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
}

.bar {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 8px;
  background: #303336;
  gap: 8px;
  flex: 0 0 28px;

  button {
    height: 20px;
    border: 1px solid #4a4e53;
    background: #3a3e42;
    color: #fff;
    border-radius: 3px;
    padding: 0 8px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }

  .toggle {
    border: 0;
    background: transparent;
    padding: 0;
    color: #e8c547;
    font-weight: 700;
  }

  .count {
    margin-left: 6px;
    color: #9aa0a6;
    font-weight: 400;
  }
}

.log {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 6px 8px 8px;
  overflow: auto;
  list-style: none;
  font: 12px/1.45 "Consolas", "IBM Plex Mono", monospace;
}

.empty {
  color: #6b7178;
}

.lvl {
  display: inline-block;
  min-width: 42px;
  margin-right: 8px;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: #9aa0a6;
}

.msg {
  white-space: pre-wrap;
  word-break: break-word;
}

.log .info .lvl {
  color: #7cb8ff;
}

.log .warn {
  color: #ffd666;
}

.log .warn .lvl {
  color: #ffd666;
}

.log .error {
  color: #ffccc7;
}

.log .error .lvl {
  color: #ff7875;
}
</style>
