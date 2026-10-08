# 旧目录迁移映射

Updated: 2026-10-08

| 当前 | 新模块 | 说明 |
|---|---|---|
| `src/core/Viewer.ts` | `engine-cesium` + `scene` + `sdk` | 组合式 Arc3DApp |
| `src/core/Layers.ts` | `layers` + `graphics` | 图层与要素分离 |
| `src/core/EventEmitter.ts` | `core/event` + `interaction` | 领域事件与指针事件分离 |
| `src/core/Terrain.ts` | `layers/TerrainManager` | 地形作为 Layer 能力 |
| `src/core/PopupTip` | `ui/TooltipService` | textContent + canvas 坐标 |
| `src/core/add-creator` | `graphics/factory` | Creator 与 Backend 分离 |
| `src/core/graphics` | `graphics` | 一等领域对象 |
| `src/core/layers` | `layers` + `data` | Provider 与 Layer 分层 |
| `src/core/material` | `effects/material` | 材质进入特效域 |
| `src/types` | `core/types` | LngLat / CameraPose |
| `src/utils` | `core` / `data` / `scene` | 按职责拆分 |
| `src/static` | `engine-cesium/assets` | 默认底图资源 |
| `demo-vue3` | `examples/vue3` | 框架示例 |
| `demo-html` | `examples` 过渡 | 后续升级 Playground |

2026-10-08 起，旧 `src/core`、`src/utils`、`src/types`、`src/static` 已从仓库移除。实现只保留 `packages/*` 与根入口 `src/index.ts`。
