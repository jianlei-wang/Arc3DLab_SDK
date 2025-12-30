<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onBeforeMount } from "vue"
import treeDatas from "../utils/view"
defineOptions({ inheritAttrs: false, name: "菜单树" })
const emits = defineEmits(["updateMenu"])
onBeforeMount(() => {
  data.value = treeDatas
})
const filterText = ref("")
const treeRef = ref<any>()
const data = ref<any[]>([])
const defaultProps = {
  children: "children",
  label: "label",
}

watch(filterText, (val: string) => {
  treeRef.value!.filter(val)
})
onMounted(() => {
  nextTick(() => {
    updateId(data.value[0].children[0])
  })
})
const filterNode = (value: string, data: any) => {
  if (!value) return true
  return data.label.includes(value)
}
const handleNodeClick = (data: any) => {
  const { id, children } = data
  if (children) return
  updateId(data, false)
}

const updateId = (data: any, bool = true) => {
  const { id } = data
  bool && treeRef.value.setCurrentKey(id)
  const url = new URL(window.location.href)
  url.searchParams.set("id", id)
  window.history.pushState({}, "", url.toString())
  emits("updateMenu", data)
}
</script>
<template>
  <div class="menu-tree-main">
    <el-input
      class="cus-input"
      v-model="filterText"
      placeholder="搜索关键字"
      size="small"
    />
    <el-tree
      ref="treeRef"
      :data="data"
      :props="defaultProps"
      :filter-node-method="filterNode"
      node-key="id"
      highlight-currents
      accordion
      @node-click="handleNodeClick"
    />
  </div>
</template>
<style lang="scss" scoped>
.menu-tree-main {
  width: 220px;
  padding: 5px;
  padding-left: 0;
  display: flex;
  flex-direction: column;
  row-gap: 3px;
  background: transparent;

  .cus-input {
    :deep(.el-input__wrapper) {
      background: transparent;
      box-shadow: none;
      border: 1px solid #2ec0fa80;
      .el-input__inner {
        color: #fff;
      }
    }
  }
  .el-tree {
    flex: 1;
    overflow-y: auto;
    background: transparent;
    :deep(.el-tree-node) {
      &.is-current {
        .el-tree-node__content {
          background: #faeb2240 !important;
          .el-text {
            color: #faeb22;
          }
        }
      }
      &:focus {
        .el-tree-node__content {
          background: transparent;
        }
      }

      .el-tree-node__content {
        margin-right: 10px;
        &:hover {
          background: #faeb2240;
        }
        .el-icon {
          color: #fff !important;
        }
        .el-text {
          color: #fff;
        }
      }
    }
  }
}
</style>
