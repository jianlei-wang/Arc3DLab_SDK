# Arc3DLab SDK 整改与优化清单

> 来源：`现有SDK整改和优化清单-1.md`（审阅基线 `jianlei_wang` / `2dbd41b`）
> 约束框架：`.monkeycode/specs/2026-10-08-arc3dlab-sdk-runtime/design.md`
> 本清单是设计框架的落地跟踪表。每项记录：优先级、问题、整改方案、验收标准、状态。
> 状态取值：`TODO` / `DOING` / `DONE` / `PARTIAL` / `DEFERRED`。

## 0. 进度总览

| 编号 | 标题 | 优先级 | 状态 |
|---|---|---|---|
| P0-01 | Engine 适配器形成可注入边界 | P0 | DONE |
| P0-02 | Ion Token 全局静态变量并发串扰 | P0 | DONE |
| P0-03 | CapabilityRegistry 能力与引擎一致 | P0 | DONE |
| P0-04 | 插件卸载异常清理 | P0 | DONE |
| P1-01 | AnalysisWorkerHost 真实 Worker 或改名 | P1 | DONE |
| P1-02 | ToolRegistry 活动工具状态机 | P1 | DONE |
| P1-03 | 插件依赖、命名空间与注册归属 | P1 | DONE |
| P1-04 | Command 参数 Schema 完整合同 | P1 | DONE |
| P1-05 | GIS 空间参考/高程基准/单位语义 | P1 | DONE |
| P1-06 | Layer/DataAsset/Feature/Graphic 语义边界 | P1 | DONE |
| P1-07 | Analysis 统一任务合同 | P1 | DONE |
| P1-08 | 真实浏览器/WebGL E2E | P1 | DEFERRED |
| P1-09 | Runtime ready 与资源 ready 语义 | P1 | DONE |
| P1-10 | 后处理 Bloom/Blur 语义 | P1 | DONE |
| P1-11 | 公共 API 类型白名单 | P1 | DONE |
| P1-12 | 领域插件样板脱离产品源码 | P1 | DONE |
| P1-13 | 统一诊断对象与异步可观测性 | P1 | DONE |
| P2-01 | 移除包管理器配置冲突 | P2 | DONE |
| P2-02 | format:check 覆盖 TypeScript 源码 | P2 | DONE |
| P2-03 | 拆分偏大的聚合源文件 | P2 | DONE |
| P2-04 | 减少内嵌静态资源影响 | P2 | DONE |
| P2-05 | 隔离开发预览与库构建配置 | P2 | DONE |
| P2-06 | Legacy Viewer 映射与废弃策略 | P2 | DONE |
| P2-07 | 同步架构文档、类型合同与测试 | P2 | DONE |
| P2-08 | 发布质量门禁 | P2 | PARTIAL |
| P2-09 | 兼容矩阵与 SemVer | P2 | DONE |
| P2-10 | 许可证与分发策略 | P2 | DONE |
| D-01 | 通用数据语义 | P1 | DONE |
| D-02 | 统一任务与结果语义 | P1 | DONE |
| D-03 | 插件合同与领域模型分开 | P1 | DONE |

## 1. P0：进入 Beta / 1.0 前必须处理

### [ ] P0-01 引擎适配器形成可注入边界

- 问题：`Arc3D.create()` 固定调用 `createCesiumEngineContext()`；Engine 实例创建后未保存到 Runtime Context；功能域直接使用 Cesium API。
- 决策：采用 Cesium-first 战略（见 design.md 1.2），Engine 定位为内部运行时适配合同；同时把 Engine 实例保存进 Context。
- 方案：
  - `EngineContext` 增加 `engine: Engine`，`createCesiumEngineContext()` 返回 Engine 实例。
  - `Arc3DContext` 增加 `engineAdapter: Engine`，销毁统一走 Engine。
  - 文档、配置类型、Context 与测试表达同一个承诺。
- 验收：Context 持有 Engine；销毁走 Engine；架构文档与类型一致；Fake Engine 可完成 `create → graphics/layers/interaction → destroy` 且不导入 Cesium。
- 状态：DONE（`EngineContext.engine`、`Arc3DContext.engineAdapter`、`createContext(config, engine, logger?, engineAdapter?)` 已落地；`engine-adapter.test.ts` 覆盖）

### [ ] P0-02 Ion Token 全局静态变量并发串扰

- 问题：Viewer 构造永久写 `Cesium.Ion.defaultAccessToken`；`withIonAccessToken()` 以保存/覆盖/恢复方式修改模块级全局值，并发任务互相覆盖。
- 方案：
  - Viewer 构造不再永久改写共享 Token。
  - 新增串行化 Token 作用域（`IonTokenScope`），所有需要全局 Token 的临界区排队执行，退出即恢复。
  - 业务层通过显式 Token 入口调用，不直接读写全局值。
- 验收：两个不同 Token 的并发任务交错执行，各自使用自身凭据，结束后全局值恢复初始状态。
- 状态：DONE（`packages/engine-cesium/src/ion.ts` 的 `SerialIonTokenScope` / `sharedIonTokenScope`；Viewer 构造不再永久改写全局 Token；`ion-token.test.ts` 覆盖）

### [ ] P0-03 CapabilityRegistry 声明的能力与实际引擎不一致

- 问题：`CORE_CAPABILITIES` 全部标为可用；`registerCoreCapabilities()` 不读取 `Engine.hasCapability()`；空 Registry 时 `require()` 直接放行。
- 方案：
  - 能力声明拆为「SDK 提供能力」和「后端实例能力」，注册时由 Engine 回报可用状态。
  - CesiumEngine 依据真实后端上报完整能力清单。
  - 删除空 Registry 放行分支。
- 验收：Fake Engine 缺 `graphic:model` 时 `has=false` 且 `require` 抛出；Cesium Engine 能力来自真实后端；测试不再期望错误的 Cesium 能力。
- 状态：DONE（`registerCoreCapabilities(registry, engine?)` 由 `Engine.hasCapability()` 回报；`source: sdk|backend`；`require` 空表抛错）

### [ ] P0-04 插件卸载异常清理

- 问题：`uninstall()` 先删 Map、再 await、最后清理；抛错则清理不发生；`dropPluginExtensions()` 只覆盖 Command/Tool/Capability。
- 方案：
  - 引入 `PluginScope` 与 `PluginScopeManager`，所有插件扩展登记进作用域。
  - 卸载使用 `try / finally`，保证撤销与清理始终执行。
  - 插件状态机：`installing / installed / uninstalling / failed / disposed`。
- 验收：uninstall、tool deactivate、资源 dispose 抛错后清理仍完成；卸载后该插件命令/能力/工具/材质/资源/pending task 均为零；反复安装卸载 20 次无残留。
- 状态：DONE（`PluginScope` / `PluginScopeManager`；卸载 `try / finally`；状态机 `installing/installed/uninstalling/failed/disposed`；`plugins.test.ts` 覆盖清理与 20 次反复安装）

## 2. P1：高优先级整改

### [ ] P1-01 AnalysisWorkerHost 真实 Worker 或改名

- 问题：`queueMicrotask()` 伪 Worker，无法在同步计算中及时响应取消。
- 方案：实现真实 Worker transport，或改名为 `AnalysisJobHost` 并明确主线程分块调度；保留取消、错误序列化与销毁语义。
- 验收：测试覆盖取消、销毁、重复提交与错误序列化。
- 状态：DONE（正名 `AnalysisJobHost`，保留 `AnalysisWorkerHost` 兼容别名；文档注明主线程调度、真实 Worker 为后续增强；`analysis-worker.test.ts` 覆盖取消/销毁/重复提交/错误序列化）

### [ ] P1-02 ToolRegistry 活动工具状态机

- 问题：新工具 `activate()` 失败时 `active` 仍保留旧工具名；`unregister`/`unregisterByPlugin` 不调用 `deactivate()`。
- 方案：明确 `deactivating → activating → active` 状态；失败回滚旧工具或进入无活动状态；注销活动工具先执行 deactivation。
- 验收：激活失败、停用失败、活动插件卸载三类测试状态一致。
- 状态：DONE（`ToolState` 状态机 `idle/deactivating/activating/active`；`unregister/unregisterByPlugin` 改 async 并先 `deactivate`）

### [ ] P1-03 插件依赖、命名空间与注册归属

- 问题：`dependsOn` 当作能力调用；命令归属靠 `CommandSpec.plugin` 自报；`plugin === "core"` 可写保留前缀。
- 方案：拆分 `requiresCapabilities` 与 `dependsOnPlugins`；由 `PluginScope` 注入不可伪造 owner ID；禁止插件冒充 Core 注册。
- 验收：插件无法以 `plugin:"core"` 注册命令；依赖缺失安装失败且无副作用；被依赖插件禁止直接卸载。
- 状态：DONE（`requiresCapabilities` 与 `dependsOnPlugins` 拆分；作用域注入不可伪造 owner；`plugin-extensions.test.ts` 覆盖保留前缀与依赖）

### [ ] P1-04 Command 参数 Schema 完整合同

- 问题：仅浅层类型；`NaN`/`Infinity` 通过；`null` 判作 object。
- 方案：可复用 Command Schema（JSON Schema 子集）：必填、额外字段、枚举、有限数值、嵌套结构；错误含字段路径与稳定错误码。
- 验收：NaN/Infinity/null/嵌套/额外字段/枚举单测；失败返回 `Arc3DError`。
- 状态：DONE（`validateCommandInput` 支持必填/枚举/有限数值/嵌套对象/额外字段/数组项，错误含字段路径；`command-schema.test.ts` 8 例）

### [ ] P1-05 GIS 空间参考、高程基准与单位语义

- 问题：`LngLat/LngLatHeight` 无 CRS、轴顺序、单位、Vertical Datum 元数据。
- 方案：引入 `SpatialReference / VerticalDatum / CoordinateTransform / TimeRange`；明确简写默认含义。
- 验收：文档与类型明确 CRS/基准/单位；投影坐标或正高不静默按经纬度解释。
- 状态：DONE（`SpatialReference / VerticalReference / TimeRange / CoordinateTransform`；`resolveSpatialReference` 默认 WGS84 度椭球高；`assertGeographicPosition` 拒绝投影坐标；`spatial-reference.test.ts` 覆盖）

### [ ] P1-06 Layer / DataAsset / Feature / Graphic 语义边界

- 问题：Layer 主要是 ResourceHandle；Graphic.properties 为 `Record<string, unknown>`；缺统一数据目录。
- 方案：引入 `DataAsset / FeatureSchema / LayerMetadata / FeatureRef`；Graphic 只负责显示与交互。
- 验收：一个数据源可被多个视图引用；卸载视图不销毁领域数据。
- 状态：DONE（`DataCatalog / DataAsset / FeatureSchema / AttributeField / FeatureRef / LayerMetadata`；`DataManager` 与影像/3D Tiles/底图登记目录；`data-catalog.test.ts` 验证卸载图层保留资产）

### [ ] P1-07 Analysis API 统一任务合同

- 问题：各分析结果形态不统一，缺统一任务 ID、状态、进度、取消、版本、血缘。
- 方案：建立 `AnalysisTask<TInput,TResult>` 与 `AnalysisResult<TResult>`；采样结果状态显式化。
- 验收：任意分析可关联输入、参数、状态、警告、单位与结果。
- 状态：DONE（`runAnalysisTask / AnalysisTaskRegistry / AnalysisTask / AnalysisResult / ResultArtifact` 已落地；`app.analysis.run()`/`tasks`；内置分析新增任务化方法 `measure/terrain/visibility/query/volume.*Task` 返回统一 `AnalysisResult` 并登记任务，非任务方法保留；`analysis-task-services.test.ts` 覆盖共享 registry、采样状态、体积、取消）

### [ ] P1-08 真实浏览器/WebGL E2E

- 问题：Vitest 环境为 node，浏览器用例被跳过。
- 方案：增加 Playwright 浏览器工作流；固定 Cesium 版本与静态资源；Token 用 mock。
- 验收：CI 至少一条浏览器用例完成创建/添加/拾取/分析/销毁/重建。
- 状态：TODO

### [ ] P1-09 Runtime ready 与资源 ready 语义

- 问题：默认底图加载晚于 `ready`，含义模糊。
- 方案：文档明确 `ready` 为 Runtime facade 就绪；资源状态独立；提供 `whenSceneReady()`（Planned）。
- 验收：默认底图成功/失败/关闭三路径状态确定。
- 状态：DONE（`02-runtime`/`11-api` 明确 `ready` 指 Runtime facade 就绪、资源状态独立；新增 `app.scene.whenSceneReady()` 返回 `SceneReadyResult`（`remainingTiles/timedOut/destroyed/defaultBaseLayer`）并派发 `sceneReady`；`CesiumEngineViewer` 跟踪默认底图 `disabled/loading/ready/failed` 三路径；`scene-ready.test.ts` 覆盖）

### [ ] P1-10 后处理 Bloom/Blur 语义

- 问题：`createBloom()` 创建 Blur stage；`setBloom()` 内置与 fallback 行为不一致。
- 方案：统一为真实 Bloom；或 API 改名 `setBlur()` 并保留兼容别名。
- 验收：真实 Viewer 与测试工厂语义一致；启用/改参/停用/重复启用/destroy 无残留。
- 状态：DONE（`createCesiumStageFactory.createBloom` 改为真实 Bloom `PostProcessStage`（亮度阈值 + 高斯加权采样）；`setBloom` 优先内置 stage）

### [ ] P1-11 公共 API 类型导出白名单

- 问题：根入口导出有限，缺完整显式公共类型白名单。
- 方案：区分 Public/Internal，导出 Options/Result/Event/Error/PluginManifest/AnalysisTask；`app.native.viewer` 标注 advanced/unstable。
- 验收：consumer 类型编译测试；禁止深路径导入 `packages/*/src`。
- 状态：DONE（`@arc3dlab/sdk` 与根入口扩展命名白名单：Graphic/Layer Options、`Arc3DEvents/LayerEvent/GraphicEvent`、空间与数据语义、`AnalysisTask/AnalysisResult/ResultArtifact` 等；新增 `tests/unit/public-api.test.ts` 消费端运行时与类型编译测试；`release-gate` 新增 `lint:api` 禁止 `src`/`examples`/`demo-vue3` 深路径导入 `packages/*/src`；`NativeContext` 标注 advanced/unstable）

### [ ] P1-12 领域插件样板脱离产品源码

- 问题：`mining-plugin.ts` 与 `plugin-harness.ts` 位于产品源码。
- 方案：Harness 移到 `tests/fixtures`；领域插件移到 `examples/domain-plugins/mining`；SDK 只保留插件合同。
- 验收：npm tarball 不含 Harness/固定样例；示例可从公共 API 安装运行。
- 状态：DONE（Harness 移到 `tests/fixtures/plugin-harness.ts`；领域插件移到 `examples/domain-plugins/mining-plugin.ts`；`@arc3dlab/sdk` 不再导出二者）

### [ ] P1-13 统一诊断对象与异步任务可观测性

- 问题：诊断缺插件、pending task、加载失败、后处理、销毁错误等。
- 方案：Diagnostics 统一暴露生命周期、资源计数、监听数、活动工具、插件、pending task、错误摘要；只读快照。
- 验收：销毁/取消/卸载后诊断可用于断言无残留；不泄露可变内部结构。
- 状态：DONE（`RuntimeDiagnostics` 增补 `capabilities/commands/tools/activeTool/pluginScopes`；`Arc3DApp.getDiagnostics()` 追加 `postprocess` / `plugins`；只读快照）

## 3. P2：结构、工程化与长期维护

### [ ] P2-01 移除包管理器配置冲突

- 删除或说明 `pnpm-workspace.yaml`；CI 校验唯一 lockfile 与 packageManager。
- 状态：DONE（`packageManager: npm@10.9.4` 为准；`pnpm-workspace.yaml` 顶部注释声明 npm 为唯一包管理器；保留 npm lockfile）

### [ ] P2-02 format:check 覆盖主要 TypeScript 源码

- 令 `format:check` 与 `format` 使用相同 glob，纳入 `packages/**/*.ts`、`src/**/*.ts`、`tests/**/*.ts`。
- 状态：DONE（两者共用同一 glob，并纳入 `examples/**/*.ts`；全仓已通过 `prettier --check`）

### [ ] P2-03 拆分偏大的聚合源文件

- 拆分 `graphics/layers/scene` 的 `index.ts` 为职责单一文件，`index.ts` 只做导出。
- 状态：DONE（graphics → `types/helpers/points/managed-graphic/graphic-manager`；layers → `types/basemap/imagery/terrain/tileset/layer-manager`；scene → `camera/render/viewport/clock/environment/scene-controller`；三个 `index.ts` 只做导出，公开符号与行为不变）

### [ ] P2-04 减少内嵌静态资源对主包的影响

- 记录 bundle size 基线，评估独立静态资源或按需加载。
- 状态：DONE（`bundle-baseline.json` + `lint:size` 在 CI `build` 后校验 raw/gzip 体积；默认底图 `globe.jpg` 由 `?url&no-inline` 独立产出并按需加载，engine chunk 从约 126.8 kB 降至 9.3 kB；`lint:size` 额外校验必需资源存在并禁止大 base64 内联）

### [ ] P2-05 隔离开发预览与库构建配置

- `server.allowedHosts` 移到 demo/preview 配置；根 `vite.config.ts` 只负责库构建。
- 状态：DONE（根 `vite.config.ts` 移除 `server` 块，只保留库构建；`allowedHosts` 由 `demo-vue3/vite.config.ts` 承担）

### [ ] P2-06 Legacy Viewer 映射与废弃策略

- 明确每个旧方法映射与不支持范围；避免返回不同类别的管理器；补弃用计划。
- 状态：DONE（`Viewer` 标注 `@deprecated` 与逃生舱说明；`Layers.get` 修正为返回 Graphic/Layer 句柄而非管理器；`13-migration` 补充方法映射表与 1.x→2.0 废弃计划）

### [ ] P2-07 同步架构文档、类型合同与自动化测试

- 更新 `02-runtime`、`10-effects-ui-plugin`、`11-api`；文档标注 Implemented/Partial/Planned；CI 校验导出 API 报告。
- 状态：DONE（已更新 `02-runtime`、`03-engine`、`10-effects-ui-plugin`、`11-api` 与 `CHANGELOG`；导出 API 报告由 `lint:exports` 覆盖）

### [ ] P2-08 完善发布质量门禁

- CI 纳入浏览器 E2E、公共 API 类型消费、覆盖率阈值、bundle size、依赖漏洞扫描、最小权限。
- 状态：PARTIAL（`gate` 已覆盖 typecheck/test/deps/exports/license/api/format；CI 新增 `lint:size`（bundle 体积基线 + 资源外置检查）、`lint:audit`（`npm audit --omit=dev --audit-level=high`）、`test:coverage`（v8 覆盖率阈值）、`permissions: contents: read` 最小权限；仅剩浏览器 E2E，跟随 P1-08 DEFERRED 一并处理）

### [ ] P2-09 建立兼容矩阵与 SemVer 变更管理

- 区分「精确锁定」与「支持范围」；公共 API 变更同步 CHANGELOG 与迁移指南。
- 状态：DONE（`COMPATIBILITY.md` 建立兼容矩阵、精确锁定/支持范围策略、SemVer 承诺范围与变更管理流程）

### [ ] P2-10 明确许可证与分发策略

- 评估 GPL-2.0-only 对商业闭源/二次分发的影响，形成发布策略。
- 状态：DONE（`12-engineering` 增加许可证分发策略矩阵：开源集成 / 闭源静态链接 / 独立 Web 服务 / 二次分发；`lint:license` 校验发布文件与许可证一致）

## 4. 业务语义扩展清单

### [ ] D-01 通用数据语义

- `DataAsset / FeatureSchema / AttributeField / FeatureRef / LayerMetadata`。
- 验收：同一 Feature 可有多种 Graphic 表达；更新渲染不改原始数据版本。
- 状态：DONE（`DataAsset.version` + `LayerMetadata.assetId` 支持多视图复用同一资产；`FeatureRef(assetId, featureId, version)` 稳定引用）

### [ ] D-02 统一任务与结果语义

- `AnalysisTask / AnalysisResult / ResultArtifact`。
- 验收：所有分析统一诊断、取消、重试、保存与追溯。
- 状态：DONE（统一 `AnalysisTask / AnalysisResult / ResultArtifact`，状态机、进度、取消、计时、错误码、`inputSnapshot` 与 `artifacts`；`analysis-task.test.ts` 覆盖成功/失败/取消/进度）

### [ ] D-03 插件合同与领域模型分开

- 通用 SDK 与领域插件职责分离；插件通过正式合同扩展。
- 验收：新增非矿山示例插件不需修改 `core`。
- 状态：DONE（`examples/domain-plugins/sample-report-plugin.ts` 仅用 `Arc3DPlugin/Arc3DContext/commands/runAnalysisTask`；`plugin-example.test.ts` 安装→执行→卸载全程不改 `core`）

## 5. 推荐整改顺序

1. 运行时问题：Ion Token 并发、能力注册、插件卸载清理、Tool 状态机。
2. 架构战略：Cesium-first 定位；同步配置类型、Context、包边界与文档。
3. 空间与分析合同：CRS/Vertical Datum、DataAsset/LayerMetadata、AnalysisTask/Result。
4. 真实浏览器测试。
5. 业务域扩展。
6. 工程质量治理。
