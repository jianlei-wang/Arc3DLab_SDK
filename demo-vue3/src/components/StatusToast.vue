<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>

<template>
  <div class="toast" role="status">{{ message }}</div>
</template>

<style scoped lang="scss">
.toast {
  position: absolute;
  left: 50%;
  bottom: 24px;
  z-index: 40;
  transform: translateX(-50%);
  padding: 8px 14px;
  border: 1px solid #8a7320;
  border-radius: 4px;
  background: #1f2124;
  color: #e8c547;
  font: 13px/1.3 "Trebuchet MS", "Segoe UI", sans-serif;
  box-shadow: 0 8px 24px #0008;
  pointer-events: none;
}
</style>
