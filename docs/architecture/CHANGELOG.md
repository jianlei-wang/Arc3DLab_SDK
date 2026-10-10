# 设计迭代日志

## 2026-10-10（覆盖率与 CI 最小权限）

- P2-08：新增 `@vitest/coverage-v8` 与 `npm run test:coverage`，覆盖率阈值 lines/statements 60、functions 58、branches 75；CI 以 `test:coverage` 替代 `test`。
- CI workflow 增加 `permissions: contents: read`。
- `.gitignore` 忽略 `coverage/`；文档同步 `12-engineering`（测试与 CI 门禁）、清单。

## 2026-10-10（静态资源外置）

- P2-04：默认底图 `globe.jpg` 从内联 base64 改为 `?url&no-inline` 独立资源，`vite.config.ts` 增加 `base: "./"`，产物用 `new URL("globe.jpg", import.meta.url)` 模块相对引用并按需加载；引擎 chunk 从约 126.8 kB 降至 9.3 kB，`dist/globe.jpg`（88.1 kB）单独发布。
- `bundle-baseline.json` 增加 `requiredAssets` 与 `inlineImageLimitBytes`；`lint:size` 校验必需资源存在并禁止在大 JS 中内联超过阈值的 base64 图片。
- 源码 `assets/globe-img.ts` 改为转发 `globe.jpg?url&no-inline`，新增 `vite-env.d.ts` 引用 `vite/client` 类型。
- 文档同步 `12-engineering`（体积与静态资源）、清单。

## 2026-10-10（首屏就绪语义）

- P1-09：新增 `SceneReadyResult` / `SceneReadyOptions` / `DefaultBaseLayerState` 合同；`EngineViewer` 增加可选 `whenSceneReady()`。
- `CesiumEngineViewer` 实现 `whenSceneReady()`：等待 Globe 瓦片加载完成与初始渲染帧，跟踪默认底图 `disabled / loading / ready / failed`，支持 `timeoutMs`、销毁中断；`SceneController.whenSceneReady()` 委托引擎并派发 `sceneReady` 事件，非 Cesium 引擎回退为已就绪。
- 公共 API：`@arc3dlab/sdk` 与根入口导出 `SceneReadyOptions` / `SceneReadyResult` / `DefaultBaseLayerState`，`Arc3DEvents` 增加 `sceneReady`。
- 测试新增 `tests/unit/scene-ready.test.ts`；`tests/fixtures/fake-context.ts` TestViewer 支持可配置场景就绪结果。
- 文档同步 `02-runtime`、`11-api`、`design.md` 4.1（sceneReady → Implemented）。
- bundle 基线随功能增长更新为 `arc3dlab.esm.js` raw 112775 / gzip 26758。

## 2026-10-10（分析任务化与工程门禁）

- P1-07 收尾：新增任务执行器 `createTaskExecutor` / `AnalysisTaskExecutor`（`packages/analysis/src/task-executor.ts`）。
- 内置分析新增任务化方法，返回统一 `AnalysisResult` 并登记到 `app.analysis.tasks`：`measure.{distance,area,height,heading,spaceAngle}Task`、`terrain.{sampleHeight,slope,profile}Task`、`visibility.{lineOfSight,viewshed}Task`、`query.{rectangle,polygon,distance}Task`、`volume.cutFillTask`；`AnalysisManager` 共享同一 `AnalysisTaskRegistry`，非任务方法保留原始返回。
- 公共合同扩展：`@arc3dlab/sdk` 与根入口新增 `createTaskExecutor` / `AnalysisTaskExecutor`。
- P2-04 / P2-08：新增 `bundle-baseline.json` 与 `scripts/check-bundle-size.mjs`（`lint:size`，原始与 gzip 体积对比基线 +5% 容忍），新增 `lint:audit`（`npm audit --omit=dev --audit-level=high`），CI 在 `build` 后执行 `lint:size`。
- 测试新增 `tests/unit/analysis-task-services.test.ts`（5 例），总计 226 passed | 1 skipped。
- 文档同步 `09-analysis`、`11-api`、清单。

## 2026-10-10

- 落地通用业务语义层（P1-05 / P1-06 / P1-07 / D-01 / D-02 / D-03）：
  - 空间语义：`SpatialReference / VerticalDatum / VerticalReference / TimeRange / CoordinateTransform`；`LngLat` 简写明确为 WGS84、度、椭球高；投影坐标经 `assertGeographicPosition` 拒绝而非静默按经纬度解释。
  - 数据语义：`DataCatalog / DataAsset / FeatureSchema / AttributeField / FeatureRef / LayerMetadata`；`DataManager` 与影像/3D Tiles/底图登记目录，图层销毁不清除领域数据。
  - 分析合同：`runAnalysisTask / AnalysisTaskRegistry / AnalysisTask / AnalysisResult / ResultArtifact`，统一状态、进度、取消、计时、错误与产物；`AnalysisManager.run()` 与 `AnalysisManager.tasks`。
  - 插件扩展：新增 `examples/domain-plugins/sample-report-plugin.ts`，仅用公共合同扩展，验证无需修改 `core`。
- 文档同步 `05-layers`、`07-data`、`09-analysis`、`11-api`。
- 测试新增 spatial-reference、data-catalog、analysis-task、plugin-example，共 16 例。

## 2026-10-10（工程化与公共合同）

- P1-11：`@arc3dlab/sdk` 与根入口白名单扩展（Options / Event / 空间数据语义 / `AnalysisTask` 等）；新增 `tests/unit/public-api.test.ts` 消费端类型测试；`release-gate` 新增 `lint:api`，禁止 `src` / `examples` / `demo-vue3` 深路径导入 `packages/*/src`。
- P2-03：拆分 `graphics` / `layers` / `scene` 的聚合 `index.ts` 为职责单一文件，`index.ts` 只做导出；公开符号与行为保持不变。
- P2-05：根 `vite.config.ts` 只负责库构建，dev server `allowedHosts` 交由 `demo-vue3` 预览配置。
- P2-06：`Viewer` 标注 `@deprecated`，修正 `Layers.get` 返回资源句柄而非管理器对象，补充方法映射与废弃计划。
- P2-09 / P2-10：建立兼容矩阵与 SemVer 变更策略（`COMPATIBILITY.md`），明确 GPL-2.0-only 分发策略（`12-engineering`）。
- 文档同步 `12-engineering`、`13-migration`、`COMPATIBILITY`、`CHANGES`。

## 2026-10-09

- 重写整体设计框架 `design.md`：明确 Cesium-first 定位、依赖硬规则、运行时主流程、关键合同、业务语义层、模块清单与质量门禁。
- 建立 `SDK整改与优化清单.md`，跟踪 P0/P1/P2 与业务语义扩展项。
- P0：Engine 保存进 Context 并可注入（`engineAdapter`）；Ion Token 改为串行化作用域；Capability 由 Engine 回报真实可用性并移除空表放行；插件作用域与卸载 `try / finally` 清理。
- P1：ToolRegistry 状态机；Command 参数 Schema（必填/枚举/有限数值/嵌套/额外字段/数组项，错误含字段路径）；插件依赖拆分为 `requiresCapabilities` 与 `dependsOnPlugins`；Bloom 使用真实后处理着色器；`AnalysisWorkerHost` 正名 `AnalysisJobHost`（保留兼容别名）；诊断对象补齐能力/命令/工具/活动工具/插件作用域；领域插件样板迁出产品源码到 `examples/` 与 `tests/fixtures`。
- 文档同步：`02-runtime`、`03-engine`、`10-effects-ui-plugin`、`11-api` 标注实现状态与就绪语义。
- Sandcastle 示例通过 gui 在地球左上角创建按钮、开关和下拉菜单。
- 左侧底部增加运行控制台，捕获示例 console 输出。

## 2026-10-08

- 初始化可迭代设计框架，落盘 00-14 模块文档。
- 确立产品定位：模块化 3D WebGIS Runtime，Cesium 作为首个引擎适配器。
- 确立第一阶段策略：内部 packages 模块化，对外仍发布 `arc3dlab`。
- 主 API 切换为 `Arc3D.create()`，`Viewer` 降为兼容层。
- P0 治理项纳入实现范围：GPL-2.0 许可证一致、Token 运行时注入、Credits 管理、资源生命周期。

## 2026-10-08

- 按最终设计收口源码边界：删除旧 Cesium 封装目录，静态资源迁入 `engine-cesium/assets`。
- Scene 补齐 Render / Viewport / Clock / Environment 控制器。
- LayerManager 暴露 `layers.data`，公共 API 导出 `Graphic` / `Layer`。

## 2026-10-08

- 新增 SDK 开发说明：`docs/guides/sdk-development.md`，覆盖即时测试、预览、API 文档和发布。

## 2026-10-08

- Cesium 固定为 `1.146.0`。
- Sandcastle playground 的 JavaScript 编辑器移到地球左侧。

## 2026-10-08

- 移除 `demo-html`。Playground 由 `demo-vue3` Sandcastle 承担。

## 2026-10-08

- 启动 P2 能力增长：Model Graphic、Data Provider、拾取/选择、基础测量、Material Registry。
- `app.graphics.addModel` 纳入 Graphics 契约。
- `app.data.createProvider` / `load` 成为数据接入入口。
- Interaction 补齐 hover、pickGraphic、pickLayer、selection。
- Analysis 测量补齐 height / heading / horizontalDistance / verticalDistance / spaceAngle。

## 2026-10-08

- P2 补齐地形采样 / 坡度坡向 / 剖面、通视 / 径向视域、PostProcess。

## 2026-10-08

- P2 补齐空间查询、Globe 剖切、地形夸张。

## 2026-10-08

- P2 补齐视域贴地可视化、土方挖填、开挖剖切。
