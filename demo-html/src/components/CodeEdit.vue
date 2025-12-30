<script setup lang="ts">
import { ref, onBeforeMount } from "vue"
import { Codemirror } from "vue-codemirror"
import { oneDark } from "@codemirror/theme-one-dark"
import { javascript } from "@codemirror/lang-javascript"
import {
  DocumentCopy,
  Fold,
  Expand,
  VideoPlay,
  Download,
  Refresh,
} from "@element-plus/icons-vue"
import useClipboard from "vue-clipboard3"
import { ElMessage } from "element-plus"
defineOptions({ inheritAttrs: false, name: "代码编辑组件" })
const props = defineProps({
  curCode: { type: String, default: "" },
})
const emits = defineEmits(["writeCode", "updateMenu"])
const baseCode = ref("")
const code = ref("")
const extensions = [javascript(), oneDark]
const myCm = ref<any>(null)

onBeforeMount(() => {
  code.value = props.curCode
  baseCode.value = code.value
  finish.value = true
})
const finish = ref(false)
const tools = [
  { id: "copy", name: "复制", icon: DocumentCopy },
  { id: "run", name: "运行", icon: VideoPlay },
  { id: "refresh", name: "刷新", icon: Refresh },
  { id: "download", name: "下载", icon: Download },
]
const { toClipboard } = useClipboard()
const startTool = (id: string) => {
  switch (id) {
    case "copy":
      copy()
      break
    case "run":
      play()
      break
    case "refresh":
      refresh()
      break
    case "download":
      download("demo.html", code.value)
      break
  }
}

const download = (filename: string, text: string) => {
  var element = document.createElement("a")
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  )
  element.setAttribute("download", filename)
  element.style.display = "none"
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}
const play = () => {
  emits("writeCode", code.value)
}
const refresh = () => {
  code.value = baseCode.value
  emits("writeCode", code.value)
}
const copy = async () => {
  try {
    await toClipboard(code.value)
    ElMessage.success("复制成功")
  } catch (e) {
    ElMessage.error("复制失败：" + e)
  }
}
const onChanges = () => {
  if (myCm.value) {
    code.value = myCm.value.content
  }
}

const expand = ref(true)
const openMenu = () => {
  expand.value = !expand.value
  emits("updateMenu", expand.value)
}
</script>
<template>
  <div class="code-edit-main">
    <div class="code-h">
      <div class="code-h-title">
        <el-icon @click="openMenu">
          <component :is="expand ? Fold : Expand"></component>
        </el-icon>
        <span>源代码编辑器</span>
      </div>

      <div class="code-h-right">
        <span
          class="ch-tool pointer"
          v-for="item in tools"
          @click="startTool(item.id)"
        >
          <el-icon><component :is="item.icon"></component></el-icon>
          <span>{{ item.name }}</span>
        </span>
      </div>
    </div>
    <Codemirror
      v-if="finish"
      ref="myCm"
      v-model="code"
      :extensions="extensions"
      @changes="onChanges"
      class="experience-editor-code"
    ></Codemirror>
  </div>
</template>
<style lang="scss" scoped>
.code-edit-main {
  display: flex;
  flex-direction: column;
  width: 34%;
  height: 100%;
  background-color: #3f404b40;

  .code-h {
    display: flex;
    height: 32px;
    line-height: 32px;
    justify-content: space-between;
    font-size: 14px;
    padding: 0 5px;
    .code-h-title {
      display: inline-flex;
      align-items: center;
      column-gap: 5px;
      .el-icon {
        cursor: pointer;
      }
    }

    .code-h-right {
      display: flex;
      column-gap: 10px;
      .ch-tool {
        display: inline-flex;
        align-items: center;
        font-size: 12px;
        &:hover {
          color: #fac94d;
        }
      }
    }
  }

  .experience-editor-code {
    height: calc(100% - 37px);
    overflow: auto;
    display: block !important;
    margin-bottom: 5px;
    background-color: #282c34;
    :deep(.cm-editor) {
      width: 100%;
      height: 100%;
    }
  }
}
</style>
