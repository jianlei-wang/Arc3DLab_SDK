# Arc3DLab

[**版本日志**](./CHANGES.md) | [**历史日志**](./LOG.md)

Arc3DLab 是面向三维 WebGIS 应用的模块化场景运行时 SDK。CesiumJS 是首个渲染引擎。

定位为 **Cesium-first**：`core` 不依赖 Cesium，业务包可直接使用 Cesium；`Engine` 是内部生命周期/能力接缝，多渲染后端为长期路线图，不是当前 API 合同。包为 **ESM-only**，通过 `import` 使用，不支持 CommonJS `require()`（详见 `COMPATIBILITY.md`）。

设计文档位于 `docs/architecture/`，开发说明位于 `docs/guides/sdk-development.md`，迁移指南位于 `docs/guides/migration.md`。发布检查清单位于 `docs/guides/release-checklist.md`，稳定性分级与弃用周期见 `COMPATIBILITY.md`。

## 文档体系

- **开发指南**（面向使用者，任务导向）：`guide/`，本地预览 `npm run guide:dev`（端口 5175）。
- **API 参考**（从源码自动生成）：`api-docs/`，构建 `npm run docs`，预览 `npm run docs:preview`（端口 5174）。
- **Sandcastle 示例**（可运行、可编辑）：`demo-vue3/`，端口 5173。

三者在顶栏互相链接。

## 开发

SDK 迭代、即时测试、预览、API 文档和发布流程见 `docs/guides/sdk-development.md`。

### 本地开发

如果您想为本项目贡献代码或在本地测试修改，可以使用以下开发命令：

```bash
# 构建 ESM
npm run build

# 单元测试
npm test

# 生成 API 文档
npm run docs

# 开发指南（VitePress，端口 5175）
npm run guide:dev
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

`Arc3D.create()` 解析只表示运行时门面就绪。需要初始飞行、截图或依赖底图瓦片的量算时，先等待场景就绪：

```ts
const result = await app.scene.whenSceneReady({ timeoutMs: 10000 })
if (!result.ready || result.defaultBaseLayer === "failed") {
  console.warn("scene not ready", result.timedOut, result.defaultBaseLayer)
}
```

旧版 `Viewer` / `Map` 兼容入口已在 2.0.0 随 `@arc3dlab/legacy` 包移除。旧代码请迁移到 `Arc3D.create()`，映射见 `docs/architecture/13-migration.md`。

### 3. 注意：若出现Cesium静态文件访问出错

```bash
# 引入 vite-plugin-cesium 插件
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
