<script setup lang="ts">
import { ref } from "vue"
import CodeEdit from "./components/CodeEdit.vue"
import Header from "./components/Header.vue"

import MenuTree from "./components/MenuTree.vue"

const iframeContainer = ref<HTMLDivElement | null>(null)

const updateCode = (code: string) => {
  curCode.value = code
  curKey.value = Date.now().toString()
  if (iframeContainer.value) {
    iframeContainer.value.innerHTML = ""
  }

  // 创建新的 iframe
  const iframe = document.createElement("iframe")
  iframe.style.width = "100%"
  iframe.style.height = "100%"
  iframe.style.border = "none"
  iframe.allowFullscreen = true

  // 将 iframe 插入到容器中
  iframeContainer.value?.appendChild(iframe)

  // 写入新的内容
  iframe.contentWindow?.document.open()
  iframe.contentWindow?.document.write(code)
  iframe.contentWindow?.document.close()
}
const show = ref(true)
const showMenu = (bool: boolean) => {
  show.value = bool
}
const curCode = ref("")
const updateHtml = async (data: any) => {
  const { id, label } = data
  const name = id + "-" + label
  const code = await fetchHtmlContent(`./${name}.html`)
  updateCode(code)
  document.title = name
}
const curKey = ref("default")

/**
 * 动态加载 HTML 文件内容
 * @param {string} path - HTML 文件的路径
 * @returns {Promise<string>} - 返回 HTML 文件的内容
 */
async function fetchHtmlContent(path: string): Promise<string> {
  try {
    const response = await fetch(path)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch HTML content from ${path}: ${response.statusText}`
      )
    }
    return await response.text()
  } catch (error) {
    return "显示错误"
  }
}
</script>

<template>
  <div class="demo-main">
    <Header></Header>
    <div class="main-content">
      <MenuTree v-show="show" @update-menu="updateHtml"></MenuTree>
      <div class="project-main">
        <CodeEdit
          :cur-code="curCode"
          @write-code="updateCode"
          @update-menu="showMenu"
          :key="curKey"
        ></CodeEdit>
        <div ref="iframeContainer" class="map-box"></div>
      </div>
    </div>
    <span class="copyright">☆ Arc-3D-Lab || ISC License ☆</span>
  </div>
</template>

<style scoped>
.demo-main {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  .main-content {
    display: flex;
    width: 100%;
    flex: 1 1 auto;
    background: #000;
    height: 0;
    .project-main {
      flex: 1;
      display: flex;
      .map-box {
        flex: 1;
        background: #000;
      }
    }
  }
  .copyright {
    position: absolute;
    right: 10px;
    bottom: 8px;
    z-index: 1;
    font-size: 12px;
    color: #ffffff90;
  }
}
</style>
