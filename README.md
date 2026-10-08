# Arc3DLab

[**版本日志**](./CHANGES.md) | [**历史日志**](./LOG.md)

Arc3DLab 是面向三维 WebGIS 应用的模块化场景运行时 SDK。CesiumJS 是首个渲染引擎。

设计文档位于 `docs/architecture/`，迁移指南位于 `docs/guides/migration.md`。

## 开发

### 本地开发

如果您想为本项目贡献代码或在本地测试修改，可以使用以下开发命令：

```bash
# 构建 ESM
npm run build

# 单元测试
npm test

# 生成 API 文档
npm run docs
```

### 1. 安装

```bash
npm i arc3dlab cesium
```

### 2. 创建场景

```ts
import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({
  container: "map",
  tokens: {
    cesiumIon: import.meta.env.VITE_CESIUM_ION_TOKEN,
  },
})

app.graphics.addPolygon({
  positions: [
    [120.1, 30.2],
    [120.2, 30.2],
    [120.2, 30.3],
    [120.1, 30.3],
  ],
  style: {
    fill: "#2F80ED88",
    outline: true,
    outlineColor: "#FFFFFF",
  },
})
```

兼容旧入口：

```ts
import { Viewer } from "arc3dlab"
const viewer = new Viewer("map")
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

本仓库许可证为 GNU GPL v2.0，详见 `LICENSE` 与 `NOTICE.md`。
