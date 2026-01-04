# arc3dlab

[**版本日志**](./CHANGES.md) | [**历史日志**](./LOG.md)

`arc3dlab` 是基于开源项目 `Cesium` 进行二次开发的二三维一体的 `WebGis` 应用框架，该框架优化了部分 `Cesium` 的使用方式并基于业务开发相应功能方法，旨在为开发者快速构建 `WebGis` 应用。

demo-vue3为测试npm发布包样例项目
demo-html为静态页面样例项目

## 开发

### 本地开发

如果您想为本项目贡献代码或在本地测试修改，可以使用以下开发命令：

```bash
# 构建项目
npm run build

# 开发模式 - 构建并准备测试
npm run dev

# 开发监听模式 - 自动监听文件更改并重新构建
npm run dev:watch

# 将构建结果复制到 demo-html 项目
npm run build:copy

# 生成 API 文档
npm run docs
```

### 1.npm引入

```bash
npm i arc3dlab --save-dev
```

### 2.创建基础地球——以在vue3中使用为例

```vue
<script setup lang="ts">
import { Viewer } from 'arc3dlab';
import { nextTick, onMounted } from 'vue';
onMounted(() => {
  nextTick(() => {
    window.viewer = new Viewer('map');
    console.log(window.viewer);
  });
});
</script>

<template>
  <div id="map"></div>
</template>

<style scoped lang="scss">
#map {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
```

### 3. 注意：若出现Cesium静态文件访问出错

```bash
// 引入vite-plugin-cesium插件
npm i vite-plugin-cesium --save-dev
```

vite.config.ts配置

```typescript
import cesium from "vite-plugin-cesium"

export default defineConfig({
  plugins: [cesium()],
})
```

## 版权声明

```warning
☆ Arc3DLab || ISC License ☆
```

## 谢谢
