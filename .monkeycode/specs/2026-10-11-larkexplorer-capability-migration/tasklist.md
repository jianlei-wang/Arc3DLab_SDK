# Implementation Task List

Feature: larkexplorer-capability-migration
Updated: 2026-10-11

## Overview

将旧 `LarkExplorer-SDK` 能力按 P0–P6 阶段迁移到当前 SDK。每个任务给出关联需求、落点与验证方式。未标注依赖的任务在同一阶段内可并行。

约定：

- 提交信息与代码注释使用中文说明；TSDoc 正文中文、标识符与签名英文。
- 新增公共符号必须补齐中文 TSDoc 并通过 `lint:docs`。
- 计算类能力必须以 `runAnalysisTask` 运行并返回 `AnalysisResult`。
- 新增能力必须在 `CORE_CAPABILITIES` 注册，并纳入诊断快照。
- 每个阶段结束运行 `npm run gate`。

## Dependencies

- 引擎能力基线：`engine:cesium`、`render:entity`、`render:primitive` 已就绪。
- 分析基础：`AnalysisManager` 的 `tasks`、`run`、`runAnalysisTask` 已就绪。
- 工具基础：`ToolRegistry` 与工具状态机已就绪。
- 第三方几何算法：从 `/tmp/lark-sdk/src/modules/utils/plotting/third-party` 移植为 TypeScript 纯函数。

## Phase 0: 基础

- [x] T0-1 core 几何工具 `packages/core/src/geo.ts`
  - 实现纯函数 `degreesToRadians`、`radiansToDegrees`、`normalizeHeading`、`angleBetweenHeadings`、`pointByHeadingDistance`、`greatCircleDistanceMeters`、`interpolateLngLat`、`interpolatePolyline`、`polygonCentroid`、`extentOf` 与 `Extent`
  - 涉及相机 / 地形的屏幕换算与取高归入引擎适配层（见 `screen.ts`），不在 `core`
  - Requirement: 2；Design: core 扩展
  - Verify: `tests/unit/core-geo.test.ts` 覆盖坐标往返、插值、形心、范围与非法输入

- [x] T0-2 core 基准转换 `packages/core/src/datum.ts`
  - 实现 `wgs84ToGcj02`、`gcj02ToWgs84`、`gcj02ToBd09`、`bd09ToGcj02`、`wgs84ToBd09`、`bd09ToWgs84`、`outOfChina`
  - Requirement: 2、22；Design: core 扩展
  - Verify: `tests/unit/core-datum.test.ts` 覆盖往返一致性与境外直通

- [x] T0-3 事件控制器 `packages/interaction/src/{event-names,event-handler}.ts`
  - `event-names.ts` 纯事件名集合；`event-handler.ts` 实现 `ScreenEventController`（15 类事件）并接入 `InteractionManager.events`
  - Requirement: 3；Design: interaction 扩展
  - Verify: `tests/unit/interaction-events.test.ts` 覆盖事件名集合与判定

- [ ] T0-4 拾取扩展 `packages/interaction/src/pick.ts`
  - 现有 `InteractionManager.pick()` 已提供像素到经纬度/笛卡尔的拾取；回调式 `pickPosition`、`pickGlobal`、`pickWmts` 与服务化拾取推迟到 P1 与交互式工具一并实现
  - Requirement: 3；Design: interaction 扩展
  - Verify: 契约测试验证回调携带笛卡尔与经纬度坐标

- [x] T0-5 视图指标与后渲染 `packages/scene/src/{viewport-metrics,post-render}.ts`
  - 纯计算 `metersPerPixelAtHeight`、`extentFromCenter`；`PostRenderController`；`SceneController` 暴露 `scaleMetersPerPixel`、`viewExtent`、`postRender`、`onPostRender`
  - Requirement: 4；Design: scene 扩展
  - Verify: `tests/unit/scene-viewport-metrics.test.ts`、`tests/unit/scene-post-render.test.ts`

- [x] T0-6 兼容适配器 `packages/legacy/src/Map.ts`
  - 实现 `Map` 兼容类，映射 `Layers` / `Terrain` / `Handler` / `Navigation` / `Render` / `Screen`；未迁移能力（`Weather` / `Components` / `SpecialAnalysis` / `MilitaryPlotting`）访问时抛 `UNSUPPORTED_CAPABILITY`
  - Requirement: 1；Design: legacy 扩展
  - Verify: 类型检查与导出审计通过

- [x] T0-7 能力与导出接线
  - `core` / `@arc3dlab/sdk` / 根入口导出 geo、datum、scene（post-render、viewport-metrics）与 interaction（屏幕事件）；`legacy` 导出 `Map`
  - 能力注册（`CORE_CAPABILITIES`）随各功能阶段实现时逐项补充，避免登记尚未提供的能力
  - Requirement: 24；Design: capability / exports
  - Verify: `lint:exports`、`lint:api`、`lint:docs` 与类型检查通过

## Phase 1: 分析

- [x] T1-1 交互式量测 `packages/analysis/src/measure-tools.ts`
  - 距离（`project`/`onground`）、面积、高差、方位角、坡角、三角、体积
  - Requirement: 5；Design: analysis 扩展；依赖 T0-3
  - Verify: 契约测试覆盖各类型取点与结果；工具状态机激活/退出一致
  - 实现说明：已交付 `projectedDistanceMeters`/`surfaceDistanceMeters`/`slopeAngleDegrees`/`triangleAreaSquareMeters` 及 `MeasurementService` 对应方法与任务；交互式取点工具句柄（`ToolRegistry` 状态机）推迟到交互阶段

- [x] T1-2 缓冲区 `packages/analysis/src/buffer.ts`
  - `bufferPoint`、`bufferPolyline`、`bufferPolygon`；非正距离抛 `INVALID_ARGUMENT`
  - Requirement: 6；Design: analysis 扩展；依赖 T0-1
  - Verify: 单测验证闭合环首末一致与非法输入

- [x] T1-3 卷帘对比 `packages/analysis/src/split.ts`
  - `SwipeComparison`（`addLayer`/`setPosition`/`setActive`、`destroy`）
  - Requirement: 7；Design: analysis 扩展
  - Verify: E2E 拖动分隔条更新分割；销毁移除 DOM 与监听
  - 实现说明：基于 `scene.splitPosition` 与 `ImageryLayer.splitDirection` 实现竖直分割；水平方向暂不支持并抛 `UNSUPPORTED_CAPABILITY`

- [x] T1-4 路径展示 `packages/analysis/src/path.ts`
  - `RouteOverlay` 按 `RouteSegment.status` 着色并可选标注
  - Requirement: 8；Design: analysis 扩展
  - Verify: 单测验证分段颜色映射与显隐/销毁

- [x] T1-5 热力图 `packages/analysis/src/heatmap.ts`
  - `computeHeatmapGrid`/`gridToRgba` 纯计算 + `heatmap-overlay.ts` 的 `HeatmapOverlay`
  - Requirement: 9；Design: analysis 扩展
  - Verify: 单测验证网格归一化、渐变采样与插值
  - 实现说明：`3d` 模式当前以抬升平面近似，体数据表达推迟到后续阶段

- [x] T1-6 动态热力图 `packages/analysis/src/dynamic-heatmap.ts`
  - `DynamicHeatmapOverlay` 帧切换与定时播放，`interpolateHeatmapGrid` 帧间插值
  - Requirement: 10；Design: analysis 扩展
  - Verify: 单测验证帧间插值与销毁释放

- [x] T1-7 洪水淹没 `packages/analysis/src/flood.ts`
  - `computeFloodGrid` 纯计算 + `FloodAnalysis` 水位水面渲染
  - Requirement: 11；Design: analysis 扩展；依赖 T2 水面着色器
  - Verify: 单测验证淹没掩膜、占比与最大深度
  - 实现说明：水面使用半透明矩形近似，着色器水面推迟到 T2

- [x] T1-8 AnalysisManager 聚合与任务化
  - 在 `AnalysisManager` 暴露 `buffer`/`path`/`heatmap`/`dynamicHeatmap`/`flood`/`swipe`；计算类走 `runAnalysisTask`
  - Requirement: 24；Design: analysis 扩展
  - Verify: 类型检查与任务状态迁移单测

## Phase 2: 特效

- [ ] T2-1 天气特效 `packages/effects/src/weather.ts`
  - `rain`/`snow`/`fog`/`lightning` 的 `enable`/`disable`/`configure`
  - Requirement: 12；Design: effects 扩展
  - Verify: 契约测试验证幂等开关与阶段清理

- [ ] T2-2 粒子特效 `packages/effects/src/particles.ts`
  - 火焰、水枪、爆炸粒子，返回可销毁句柄
  - Requirement: 13；Design: effects 扩展
  - Verify: 契约测试验证实体与监听销毁

- [ ] T2-3 材质与动画 `packages/effects/src/materials.ts`
  - `DynamicSpreadMaterialProperty`、`PolylineTrailLinkMaterialProperty`，注册 `MaterialRegistry`
  - Requirement: 19；Design: effects 扩展
  - Verify: 单测验证 `definitionChanged` 与 `equals`

- [ ] T2-4 水面着色器
  - 为洪水提供水面 `PostProcessStage` / 材质，与区域裁剪协同
  - Requirement: 11；Design: effects 扩展
  - Verify: E2E 水面渲染无异常

## Phase 3: 态势标绘

- [ ] T3-1 新包脚手架 `packages/plotting`
  - 建立 `package.json`、`tsconfig`、`src/index.ts`、构建与导出接线
  - Requirement: 24；Design: plotting 包
  - Verify: 工作区构建与包导出审计通过

- [ ] T3-2 符号与参数类型 `packages/plotting/src/symbols.ts`
  - 定义 `PlotSymbol` 24 类与各符号参数类型
  - Requirement: 15；Design: plotting 包
  - Verify: 类型检查

- [ ] T3-3 几何算法移植 `packages/plotting/src/algorithm.ts`
  - 从旧 `third-party` 移植贝塞尔、箭头、弓形、集结地等算法为纯函数
  - Requirement: 15；Design: plotting 包
  - Verify: 单测验证关键几何不变量

- [ ] T3-4 绘制器与管理器 `packages/plotting/src/{plotting-manager,symbols/*}.ts`
  - `draw`、`results`、`remove`、`removeAll`；复用 `ToolRegistry`
  - Requirement: 15；Design: plotting 包；依赖 T0-3、T3-3
  - Verify: 契约测试覆盖 24 类符号绘制完成与结果登记

- [ ] T3-5 `Map` 适配器接入 `MilitaryPlotting`
  - Requirement: 1、15；Design: legacy 扩展
  - Verify: 组件测试

## Phase 4: 动态图形与可视化

- [ ] T4-1 动态图形 `packages/graphics/src/dynamic/*`
  - `addBillboard`、`addSpreadPoint`、`addRadarNormal`、`addRiver`、`addCircleDiffusion`、`addDynamicPolyline`、`addPanel`
  - Requirement: 14；Design: graphics 扩展
  - Verify: 契约测试验证动画监听销毁归零

- [ ] T4-2 体素 `packages/graphics/src/voxel.ts`
  - `MultiTileVoxel`：`showPoints`、`interpolate`、`requestData`、`destroy`
  - Requirement: 17；Design: graphics 扩展
  - Verify: 单测验证插值与资源释放

- [ ] T4-3 模型压平 `packages/graphics/src/flatten.ts`
  - `ModelFlatten`：`addPolygon`、`setEnabled`、`clear`、`destroy`
  - Requirement: 18；Design: graphics 扩展
  - Verify: 契约测试

- [ ] T4-4 多屏联动 `packages/scene/src/sync-viewer.ts`
  - `SyncViewer` 相机同步与 `destroy`
  - Requirement: 20；Design: scene 扩展
  - Verify: 契约测试验证同步与解除

- [ ] T4-5 场景出图 `packages/scene/src/shot-grid.ts`
  - `captureGrid` 按网格分幅导出
  - Requirement: 20；Design: scene 扩展
  - Verify: E2E 验证输出图片数量与尺寸

## Phase 5: 组件与数据

- [ ] T5-1 导航条 `packages/ui/src/navigation-bar.ts`
  - `NavigationBar`：`mount`/`destroy`，控件覆盖放大、缩小、复位、俯视、二维三维切换
  - Requirement: 21；Design: ui 扩展
  - Verify: 组件测试验证 DOM 与监听销毁

- [ ] T5-2 Web 服务提供者 `packages/data/src/web/{provider,types}.ts`
  - `WebServiceProvider` 接口与 `createGaodeProvider`；未注入抛 `PROVIDER_UNAVAILABLE`，缺凭据抛 `MISSING_CREDENTIALS`
  - Requirement: 22；Design: data 扩展
  - Verify: 单测使用桩 provider，验证不读取环境密钥

- [ ] T5-3 行政区划数据 `packages/core/src/china-code.ts`
  - 省市区三级数据与 `codeToText`
  - Requirement: 23；Design: core 扩展
  - Verify: 单测验证编码数量与层级完整性

- [ ] T5-4 图层高亮语义 `packages/core/src/active-style.ts`
  - `blink`/`scaling`/`jump` 应用与还原
  - Requirement: 23；Design: core 扩展
  - Verify: 契约测试验证关闭后样式还原

## Phase 6: 文档与门禁

- [ ] T6-1 开发指南章节 `guide/**`
  - 新增迁移能力章节，正文中文、示例英文标识符
  - Requirement: 24；Design: 文档
  - Verify: `npm run guide:build` 通过

- [ ] T6-2 API 文档与 TSDoc 覆盖
  - 新公共符号补齐中文 TSDoc；必要时补充文档示例
  - Requirement: 24；Design: 文档
  - Verify: `npm run lint:docs` 覆盖率达标

- [ ] T6-3 E2E 扩展 `e2e/app.spec.ts`
  - 覆盖创建 → 标绘/量测 → 天气特效开关 → 卷帘 → 销毁 → 重建
  - Requirement: 24；Design: 测试策略
  - Verify: `npm run e2e` 关键路径通过

- [ ] T6-4 体积基线与变更日志
  - 更新 `bundle-baseline.json`、`CHANGES.md`、`LOG.md`
  - Requirement: 24；Design: 门禁
  - Verify: `npm run lint:size` 通过，文档更新齐全

- [ ] T6-5 全量门禁
  - 运行 `npm run gate` 与 CI 对应步骤（含 `test:coverage`、`lint:audit`、`lint:size`、`test:pack`）
  - Requirement: 24；Design: 门禁
  - Verify: 全部通过
