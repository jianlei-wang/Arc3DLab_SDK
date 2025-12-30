<script setup lang="ts">
import { reactive, ref, onBeforeMount, onMounted } from "vue"

defineOptions({ inheritAttrs: false, name: "标题栏" })

const versionList = ref(["v0.0.2"])
const show = ref(false)
const sdkVersion = () => {
  show.value = !show.value
}
</script>
<template>
  <div class="header-main">
    <img src="/assests/Logo.png" alt="" width="64" />
    <span class="title">Arc3DLab SDK Pro</span>
    <span class="version">{{ versionList[0] }}</span>
    <span class="version">Demo For Cesium ^1.136.0</span>
    <span class="info">
      <label class="sdk-text" @click="sdkVersion">SDK下载</label>
      <a
        href="https://app.larkview.cn/larkexplorersdk/api-docs/"
        target="_blank"
        >API文档</a
      >
      <a href="https://app.larkview.cn/sdk-docs/" target="_blank">开发指南</a>
    </span>
  </div>
</template>
<style lang="scss" scoped>
.header-main {
  width: calc(100% - 30px);
  height: 79px;
  background: #313131;
  display: flex;
  align-items: center;
  padding: 0 15px;
  border-bottom: 1px solid #5d5d5d80;

  .title {
    font-size: 32px;
    color: #ffff00;
    letter-spacing: 1px;
    text-shadow: 0px 1px 0px #888, 0px 2px 0px #777, 0px 3px 0px #666,
      0px 4px 0px #555, 0px 5px 0px #444, 0px 6px 0px #333, 0px 7px 0px #222,
      0px 8px 7px #001135;
      margin-left: 10px;
  }

  .version {
    color: #9b9b9b;
    font-size: 10px;
    margin: 20px 0 0 10px;
  }
  .info {
    font-size: 13px;
    font-weight: bolder;
    position: absolute;
    right: 0px;
    padding: 0 15px;
    display: inline-flex;
    column-gap: 10px;
    letter-spacing: 1px;
    transform: translateY(5px);
    .sdk-text {
      &:hover {
        cursor: pointer;
        color: #daa520;
      }
    }
    a {
      color: #fff;
      &:hover {
        color: #daa520;
      }
    }
  }
}
</style>
