<script setup lang="ts">
import { onMounted, ref } from "vue"

const GITHUB_REPO = "jianlei-wang/Arc3DLab_SDK"
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`

defineProps<{
  galleryOpen: boolean
  query: string
  running: boolean
}>()

const emit = defineEmits<{
  toggleGallery: []
  "update:query": [value: string]
  run: []
  reset: []
}>()

const stars = ref<number | null>(null)

onMounted(async () => {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
    if (!response.ok) return
    const data = (await response.json()) as { stargazers_count?: number }
    if (typeof data.stargazers_count === "number") stars.value = data.stargazers_count
  } catch {
    stars.value = null
  }
})
</script>

<template>
  <header class="bar">
    <div class="brand">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M16 2.5 29 10v12L16 29.5 3 22V10L16 2.5z"
          fill="none"
          stroke="#e8c547"
          stroke-width="1.6"
        />
        <path d="M16 6.2 24.8 11.4 16 16.6 7.2 11.4 16 6.2z" fill="#e8c547" />
        <path d="M8.2 13.2 16 17.8V25L8.2 20.4v-7.2z" fill="#8a7320" />
        <path d="M23.8 13.2V20.4L16 25v-7.2l7.8-4.6z" fill="#c9a227" />
      </svg>
      <div class="titles">
        <strong>Arc3DLab</strong>
        <em>Sandcastle</em>
      </div>
    </div>

    <button class="ghost" type="button" :class="{ on: galleryOpen }" @click="emit('toggleGallery')">
      图库
      <span class="caret" />
    </button>

    <label class="search">
      <input
        :value="query"
        type="search"
        placeholder="搜索示例"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        @focus="galleryOpen ? undefined : emit('toggleGallery')"
      />
    </label>

    <div class="spacer" />

    <span class="ver">1.0.0-alpha.1 · Cesium 1.146.0</span>
    <a
      class="github"
      :href="GITHUB_URL"
      target="_blank"
      rel="noreferrer"
      :title="stars === null ? GITHUB_REPO : `${GITHUB_REPO} · ${stars} stars`"
    >
      <svg class="gh-mark" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.68 7.68 0 0 1 8 4.07c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
      <span>GitHub</span>
      <em v-if="stars !== null">{{ stars }}</em>
    </a>
    <button
      class="ghost"
      type="button"
      title="还原示例源码并重新运行"
      @click="emit('reset')"
    >
      重置
    </button>
    <button class="run" type="button" :disabled="running" @click="emit('run')">
      {{ running ? "运行中" : "运行" }}
    </button>
  </header>
</template>

<style scoped lang="scss">
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 12px;
  background: #303336;
  border-bottom: 1px solid #1a1c1e;
  color: #f3f4f6;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 6px;
}

.mark {
  width: 28px;
  height: 28px;
  display: block;
}

.titles {
  display: flex;
  align-items: baseline;
  gap: 8px;
  line-height: 1;

  strong {
    font-size: 18px;
    letter-spacing: 0.4px;
    font-weight: 700;
  }

  em {
    font-style: normal;
    color: #e8c547;
    font-size: 13px;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }
}

.ghost,
.run {
  border: 1px solid #4a4e53;
  background: linear-gradient(#4a4e53, #3a3e42);
  color: #fff;
  height: 28px;
  padding: 0 12px;
  border-radius: 3px;
  font: 13px/1 "Trebuchet MS", "Segoe UI", sans-serif;
  cursor: pointer;
}

.ghost.on {
  background: #1f2124;
  border-color: #e8c547;
  color: #e8c547;
}

.ghost:hover,
.run:hover:not(:disabled) {
  filter: brightness(1.08);
}

.run {
  background: linear-gradient(#f0d36a, #c9a227);
  border-color: #8a7320;
  color: #1b1404;
  font-weight: 700;
  min-width: 72px;
}

.run:disabled {
  opacity: 0.65;
  cursor: wait;
}

.caret {
  display: inline-block;
  width: 0;
  height: 0;
  margin-left: 6px;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  vertical-align: middle;
}

.search {
  flex: 0 1 240px;

  input {
    width: 100%;
    height: 28px;
    border: 1px solid #1a1c1e;
    background: #1f2124;
    color: #f3f4f6;
    border-radius: 3px;
    padding: 0 10px;
    font: 13px "Trebuchet MS", "Segoe UI", sans-serif;
    outline: none;
  }

  input:focus {
    border-color: #e8c547;
  }
}

.spacer {
  flex: 1;
}

.ver {
  color: #9aa0a6;
  font-size: 11px;
  margin-right: 4px;
}

.github {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid #4a4e53;
  border-radius: 3px;
  background: #1f2124;
  color: #f3f4f6;
  text-decoration: none;
  font: 12px/1 "Trebuchet MS", "Segoe UI", sans-serif;
}

.github:hover {
  border-color: #e8c547;
  color: #e8c547;
}

.gh-mark {
  width: 14px;
  height: 14px;
  display: block;
}

.github em {
  font-style: normal;
  color: #e8c547;
}

@media (max-width: 820px) {
  .ver,
  .titles em {
    display: none;
  }

  .search {
    flex-basis: 120px;
  }

  .github span {
    display: none;
  }
}
</style>
