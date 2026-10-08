<script setup lang="ts">
import { computed } from "vue"
import { exampleCategories, type SandcastleExample } from "../examples/catalog"

const props = defineProps<{
  examples: SandcastleExample[]
  activeId: string
  query: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const grouped = computed(() => {
  const q = props.query.trim().toLowerCase()
  const matched = props.examples.filter((item) => {
    if (!q) return true
    return `${item.title} ${item.category} ${item.summary}`.toLowerCase().includes(q)
  })
  return exampleCategories
    .map((category) => ({
      category,
      items: matched.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0)
})
</script>

<template>
  <div class="gallery">
    <div class="intro">
      <h2>示例图库</h2>
      <p>点选卡片加载源码，再按运行。代码里的 <code>app</code> 是当前 Arc3DApp。</p>
    </div>
    <section v-for="group in grouped" :key="group.category" class="bucket">
      <h3>{{ group.category }}</h3>
      <div class="cards">
        <button
          v-for="item in group.items"
          :key="item.id"
          type="button"
          class="card"
          :class="{ active: item.id === activeId }"
          @click="emit('select', item.id)"
        >
          <span class="thumb" />
          <strong>{{ item.title }}</strong>
          <small>{{ item.summary }}</small>
        </button>
      </div>
    </section>
    <p v-if="grouped.length === 0" class="empty">没有匹配的示例</p>
  </div>
</template>

<style scoped lang="scss">
.gallery {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: auto;
  padding: 20px 24px 32px;
  background:
    radial-gradient(1200px 400px at 10% -10%, #3b3418 0%, transparent 50%),
    #1c1e21f5;
  color: #f3f4f6;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
}

.intro {
  margin-bottom: 18px;

  h2 {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 700;
  }

  p {
    margin: 0;
    color: #b8bec6;
    font-size: 13px;
  }

  code {
    color: #e8c547;
  }
}

.bucket {
  margin-bottom: 22px;

  h3 {
    margin: 0 0 10px;
    font-size: 13px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #e8c547;
  }
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.card {
  text-align: left;
  border: 1px solid #3a3e42;
  background: #2a2d31;
  color: inherit;
  border-radius: 4px;
  padding: 0 0 12px;
  cursor: pointer;
  overflow: hidden;
}

.card:hover,
.card.active {
  border-color: #e8c547;
}

.thumb {
  display: block;
  height: 86px;
  background:
    linear-gradient(160deg, #4a3d12 0%, #1a3348 55%, #0f1c14 100%);
  border-bottom: 1px solid #3a3e42;
}

.card strong {
  display: block;
  margin: 10px 12px 4px;
  font-size: 14px;
}

.card small {
  display: block;
  margin: 0 12px;
  color: #9aa0a6;
  font-size: 12px;
  line-height: 1.4;
}

.empty {
  color: #9aa0a6;
}
</style>
