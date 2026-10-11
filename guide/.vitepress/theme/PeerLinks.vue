<script setup lang="ts">
import { computed, onMounted, ref } from "vue"

const origin = ref("")

onMounted(() => {
  origin.value = window.location.href
})

function peer(port: number): string {
  if (typeof window === "undefined") return `http://localhost:${port}`
  const { protocol, hostname } = window.location
  const match = hostname.match(/^\d+-(.+)$/)
  if (match) return `${protocol}//${port}-${match[1]}`
  return `http://localhost:${port}`
}

const sandcastle = computed(() => (origin.value ? peer(5173) : ""))
const apiDocs = computed(() => (origin.value ? peer(5174) : ""))
</script>

<template>
  <div class="peer-links">
    <a :href="sandcastle || 'http://localhost:5173'" target="_blank" rel="noreferrer">
      Sandcastle
    </a>
    <a :href="apiDocs || 'http://localhost:5174'" target="_blank" rel="noreferrer">
      API 文档
    </a>
  </div>
</template>

<style scoped>
.peer-links {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: 1.5rem;
}

.peer-links a {
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  white-space: nowrap;
}

.peer-links a:hover {
  color: var(--vp-c-brand-1);
}

@media (max-width: 767px) {
  .peer-links {
    display: none;
  }
}
</style>
