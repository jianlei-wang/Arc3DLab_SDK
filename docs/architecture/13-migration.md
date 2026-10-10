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
| `demo-html` | 已移除 | Playground 由 `demo-vue3` Sandcastle 承担 |

2026-10-08 起，旧 `src/core`、`src/utils`、`src/types`、`src/static` 已从仓库移除。实现只保留 `packages/*` 与根入口 `src/index.ts`。

## Legacy Viewer 方法映射

`Viewer`（`@arc3dlab/legacy`，根入口兼容导出）自 1.0.0-alpha.1 起标记 `@deprecated`，新代码使用 `Arc3D.create()`。

| Legacy 成员 | 新合同 | 说明 |
|---|---|---|
| `new Viewer(container, options)` | `Arc3D.create(config)` / `Arc3D.createSync(config)` | 构造参数映射到 `config.tokens.cesiumIon` / `config.scene` |
| `viewer.app` | `Arc3DApp` | 兼容适配器直接暴露 facade |
| `Layers.Add.addPoints(p, style, usePrimitive)` | `app.graphics.addPoints({ positions, style, renderMode })` | `usePrimitive` 映射为 `renderMode: "primitive" | "entity"` |
| `Layers.Add.addLines(p, style, usePrimitive)` | `app.graphics.addPolyline({ positions, style, renderMode })` | 同上 |
| `Layers.Add.addPolygons(p, style, usePrimitive)` | `app.graphics.addPolygon({ positions, style, renderMode })` | 同上 |
| `Layers.get(id)` | `app.graphics.get(id)` 或 `app.context.registry.get(id)` | 返回 Graphic / Layer 句柄，不再返回管理器对象 |
| `Layers.remove(id)` | `app.graphics.remove(id)` | 仅覆盖 Graphic；图层移除见 `app.layers` 各自管理器 |
| `Layers.show(id, visible)` | `app.graphics.show(id, visible)` | |
| `Layers.clear()` | `app.graphics.clear()` | |
| `Terrain` | `app.terrain` | TerrainManager |
| `EventHandler` | `app.interaction` | 领域选择与指针事件 |
| `ReminderTip` | `app.ui.tooltip` | 使用 `textContent` 与 canvas 相对坐标 |
| `native` / `scene` / `camera` / `canvas` | Cesium 运行时逃生舱 | advanced / unstable，随 Cesium 版本变化，不纳入 SemVer |
| `destroy()` | `app.destroy()` | 回收全部资源 |

不支持范围：旧版内置 Creator 工厂、`PopupTip` DOM 结构与 mapbox 之外的控制器行为没有等价合同，端口到领域插件或 `app.ui` 的对应服务。

## 废弃计划

| 阶段 | 版本 | 动作 |
|---|---|---|
| 当前 | 1.0.x | `Viewer` 仅提供兼容映射，文档主路径为 `Arc3D.create()` |
| 后续 | 1.x | 冻结方法集，只修复缺陷，不新增 legacy 能力 |
| 计划 | 2.0 | 评估移除 `@arc3dlab/legacy` 与根入口 `Viewer` 导出，迁移到 `@arc3dlab/sdk` |
