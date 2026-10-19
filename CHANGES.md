# Change Log

> 面向 SDK 使用者的发布变更日志，按版本记录 `Breaking Changes` / `feat` / `fix`。
> 面向维护者的架构与门禁迭代记录见 `docs/architecture/CHANGELOG.md`。

## 关键字说明 :mega:

```说明
## v 版本号 - 时间
### Breaking Changes：:mega: 重大变更（移除or替换）
### feat: :tada: 新功能、新特性
### fix: :wrench: 修复bug
```

## Unreleased

### feat

- 分析作业统一路由：`app.analysis` 的测量、空间查询、面积与土方网格等纯数值步骤经 `AnalysisManager` 持有的 `AnalysisJobHost` 调度，支持 `Worker` 时在独立线程执行，无 `Worker` 环境自动降级进程内；`terrain.*` / `visibility.*` 等依赖 Cesium 场景的操作保持主线程
- 公共分析合同新增 `AnalysisJobHost` / `executeAnalysisJob` 与 `AnalysisJob` / `AnalysisJobResult` / `AnalysisJobHostOptions` / `AnalysisWorkerFactory` / `AnalysisWorkerLike` 导出，`createTaskExecutor` 支持注入共享注册表与作业宿主
- `AnalysisJobHostOptions` 新增 `idleTimeoutMs`：空闲 Worker 默认保留 30 秒后自动回收，`0` 表示禁用；诊断新增 `createdWorkers` / `reclaimedWorkers` / `peakWorkers` / `idleTimeoutMs`，便于评估多实例内存与池复用效果
- `app.destroy()` 终止分析 Worker、拒绝未完成作业并清理消息与取消监听；测量与空间查询方法新增可选 `signal` 取消信号

### fix

- 空间查询在投递 Worker 前将图形注册表投影为 `{ id, type, positions }` 快照，避免把场景对象或闭包送入工作线程
- 分析作业改为每个在途作业独占一个 Worker 槽位（最多 4 个，完成后复用），取消单个作业只终止它自己的 Worker，不再连带拒绝同一宿主上的其他并发作业
- 场景形变完成监听器在恢复回调执行后立即注销，并兼容事件源在注册阶段同步触发的场景，避免多次形变后累积失效监听器
- 浏览器 E2E 扩展 Firefox 与 Worker 降级场景：覆盖 `Worker` 禁用、Worker 构造失败时的进程内回退，以及连续创建/销毁后资源与分析 Worker 计数回归基线
- 数据源加载失败保留 `failed` 图层与资产用于诊断，允许使用相同 ID 重置失败记录后重试；加载成功后登记失败或应用销毁会回滚目录记录，不再遗留 `loading` 状态
- 土方 `cutFill` 新增 `terrain` 采样来源计数（`sampled` / `fallback` / `unavailable`），地形不可用时不再把回退的椭球高 0 无提示地计入体积
- npm 发布包改为 `dist` 整树声明（排除 `dist/src` / `dist/packages` 声明中间文件），source map、Worker、静态资源与后续新增的嵌套 chunk 自动随构建发布；`scripts/publish-manifest.mjs` 生成期望清单，pack smoke 断言全部产物与入口进入 tarball 与解压安装目录，并从安装后的包内启动 Worker 执行真实作业
- 发布合同新增 ESM-only 与 Cesium 精确 peer 门禁：`lint:exports` 校验 `type: module`、无 `main` / `require` 出口、`peer` / `dev` Cesium 均为 `1.146.0`、Node `>=22` 与完整 `files` 策略

### chore

- 发布治理：新增 `release:check`（已接入 `gate:release`）校验版本号、锁文件、`CHANGES.md` 已发布小节、兼容矩阵与破坏性变更迁移说明，并在打 tag 时拒绝残留的 `Unreleased` 条目；`test:pack` 增加许可证/NOTICE 归档一致性、安装后包合同（ESM-only、无运行时依赖、精确 `cesium` peer）与源码路径泄漏检查
- 发布流程：新增 tag 触发的 `release.yml`，从同一提交运行发布门禁与 Chromium/Firefox E2E、构建 Sandcastle、打包 tarball 并归档 `api-docs` / `guide-dist` / `sandcastle-dist`；CI 新增独立 `sandcastle` job
- 最终产物同步：SDK 开发说明更新发布 `files` 整树策略、`test:pack` 与文档覆盖率现状；开发指南补充分析作业宿主公共导出与土方 `terrain` 字段；Sandcastle 土方示例输出地形采样来源计数；重新生成 API 文档站、开发指南与发布产物并跑通四类产物构建

## v2.0.0 - 2026-10-12

### Breaking Changes：:mega:

- 移除根入口 `Viewer` / `Map` 及 `LegacyViewerOptions` / `LegacyMapOptions` 导出，并删除 `@arc3dlab/legacy` 包；旧版用法迁移到 `Arc3D.create()`（见 `docs/architecture/13-migration.md`）
- 移除 `Arc3DPlugin.dependsOn` 废弃字段，能力依赖统一使用 `requiresCapabilities`
- 移除 `@arc3dlab/analysis` 的 `AnalysisWorkerHost` 兼容别名，统一使用 `AnalysisJobHost`

### fix

- 插件归属：取消注册表的全局活动 owner 推断，默认 owner 收敛为 `spec.plugin`；保留命名空间（`core.` / `arc3dlab.`）授权只依据显式 owner，插件无法通过伪造 `plugin` 字段抢占核心扩展
- 注册表读取返回防御性快照（`CommandBus.get()`、`CapabilityRegistry.get()/records()`），修改读取结果不再影响内部 owner/provider/availability
- `ResourceRegistry.clear()` 与 `DisposerStack.disposeAll()` 的错误上报回调抛错不再中断剩余资源释放
- `ToolRegistry.activate()` 在旧工具 `deactivate()` 抛错时回滚状态，工具切换失败后状态机收敛
- `DataCatalog` 明确 schema 生命周期：资产拥有的 schema 随资产注销移除，新增 `unregisterSchema()` / `hasSchema()` / `registerSchema()`
- 渲染与动态效果协调：新增持续渲染需求机制，雨雪/闪电、粒子、动态材质图元、洪水水面等依赖帧编号推进的效果在活动期间自动保持持续渲染，全部结束后自动回到按需渲染，静态场景不再因 `requestRenderMode` 与 `maximumRenderTimeChange = Infinity` 导致动画停滞；业务方无需处理底层渲染细节
- 默认占位底图与业务底图协调：占位底图可见性改为由“期望状态”驱动（`EngineViewer.setDefaultBaseLayerVisible`），业务设置自定义底图时隐藏占位图、移除底图或销毁栈再恢复，占位图先完成或业务底图先完成两种时序都不会被默认占位图覆盖
- 体素采样合同：`MultiTileVoxel` 网格节点采样改为基于输入点数据的空间插值（默认 `idw`、可选 `nearest`，新增 `power` / `padding` 选项），距离在 ENU 米制坐标系按 `cos(lat)` 折算经度；垂直跨度改用高程跨度 `maxZ - minZ`；`value = NaN` 视为缺失并输出透明；颜色定义域来自有效采样值，修复了颜色仅由网格索引构造规则梯度的缺陷
- 网格出图：`captureGrid` 每幅在设置相机后请求并等待一帧渲染完成再采集，修复按需渲染下图片仍为上一视图的问题；出图前保存相机状态并在 `finally` 中恢复（含异常路径），不再改变用户视图；新增 `maxShots`（默认 `64`）限制分幅数量并对非法 `rows` / `columns` 抛 `INVALID_ARGUMENT`
- Cesium Ion 令牌统一路径：Ion 影像、地形与 Tileset 的创建统一经实例级 `EngineContext.runWithIonToken(work, token?)` 在共享串行作用域内应用令牌并恢复，修复 Ion 影像绕过令牌作用域、配置的实例 `ionToken` 未生效的缺陷；Ion 影像在无令牌时仍按无令牌分支创建，Ion 地形无令牌仍抛 `AUTH_FAILED`
- 裁剪分析所有权与状态一致性：`app.analysis.clip` 首次写入前捕获 Globe 既有裁剪作为基线，`clear()` / `destroy()` 只释放自身创建的集合并恢复基线，未写入前不触碰 Globe；`setPolygon` / `setExcavation` 顶点少于三个时在变更前抛 `INVALID_ARGUMENT`，不再出现 `list()` 为空但场景仍存在旧裁剪的状态不同步
- 资源生命周期与状态管理统一：`app.graphics.addVoxel` / `addFlatten` 返回的 `MultiTileVoxel` / `ModelFlatten` 现实现资源句柄合同并登记进共享注册表，随 `graphics.clear()` 或应用销毁释放；`ParticleManager` 托管全部粒子句柄，`app.effects.destroy()` 统一释放；粒子对 `viewer.clock.shouldAnimate` 的覆盖改为引用计数，全部释放后恢复原值；`app.scene.sync` 返回的 `SyncViewer` 由场景控制器跟踪并随场景销毁解除相机监听；数据源句柄销毁时同步注销资产元数据，不再残留 `DataAsset`；`ManagedGraphic.positions` 返回防御性副本，外部修改不再绕过变更通知
- 标绘创建原子性：`app.plotting.draw` 的结果 `id` 在创建任何实体之前校验，重复 `id` 抛 `DUPLICATE_RESOURCE`、空字符串 `id` 抛 `INVALID_ARGUMENT`，不再覆盖既有记录而遗留无法清理的实体；多图元符号的创建改为暂存集合加成功提交，任一步失败回滚本次已创建的全部实体且不写入记录
- 空间参考等价性分层与单位校验：`sameSpatialReference` 现比较高程长度单位 `linearUnit`，相同 CRS 但单位不同（米/英尺）不再视为等价；新增 `sameHorizontalReference` / `sameVerticalReference` 分层判断与 `createCoordinateTransform`，后者仅在完全等价时返回恒等转换，否则抛 `UNSUPPORTED_CAPABILITY` 并指明差异层次，`tryCreateCoordinateTransform` 对单位差异返回 `undefined` 而不再静默视为可直接互用
- 分块分析让出与采样预算：地形、通视、可视域与规模采样的块间让出由微任务改为默认真实宏任务（`MessageChannel`，不可用时回退 `setTimeout(0)`），长分析期间渲染帧、输入与超时回调不再被阻塞；采样规模由「单次上限」升级为可选的「任务级累计预算」`AnalysisSampleBudget`，`viewshed` 由观察点与全部射线共享同一预算，累计超限明确抛 `INVALID_ARGUMENT` 而不再逐个子操作各自限额
- 动态热力图网格复用与插值播放：`showFrame()` 改用 `setFrames()` 预计算的缓存网格渲染，不再对同一帧重复计算网格；`play()` 在相邻缓存网格之间按插值比例平滑过渡（新增可选步数参数），每个帧间隔结束时前进到下一帧，相邻网格维度不一致时回退为该帧网格，帧数不足时不启动定时器
- 数值分析定位与地形状态：`terrain.profile()` 的剖面点补齐 `source` / `status`，地形不可用时以 `unavailable` 标识而非仅表现为高程 0 米；`estimatedErrorCubicMeters` 明确为边界单元经验量级指标而非数学误差上界
- 动态材质时间与相等性：动态扩散材质（`DynamicSpreadMaterialProperty`）与线尾迹材质（`PolylineTrailMaterialProperty`）的动画时间改用 `JulianDate.secondsDifference` 计算并以 `JulianDate.clone` 保存动画起点，跨过午夜的持续动画不再因 `secondsOfDay` 回绕而重置或倒退；两者 `equals()` 补齐 `duration` 比较，配置不同不再被判为相等
- Credits 展示模式可逆且不隐藏归属：`compact` 不再把 Cesium 版权容器 `display: none`（会连同第三方数据源署名一起隐藏），改为保持可见并压缩占位；切换模式前先把版权容器移回原始父节点、恢复基线 `display` 并清除压缩样式，修复 `custom → default` 后原容器位置未恢复的问题；自定义容器判定改依据节点挂载能力，兼容非 `HTMLElement` 的 `Element`

### feat

- 数值分析结果显式计算模型：`LengthResult` / `AreaResult` / `HeightResult` 新增只读字段 `model`（`ComputationModel`：`"ecef-chord"` / `"spherical"` / `"local-planar"` / `"ellipsoid-delta"`），与既有 `mode` 一起说明结果的近似性质与适用边界；`distance` 为 `ecef-chord`，球面公式（`geodesic` 距离与面积）为 `spherical`，`mode: "planar"` 面积为 `local-planar`，高差为 `ellipsoid-delta`
- `CutFillResult` 新增只读字段 `status`（`CutFillStatus`：`"computed"` / `"invalid-polygon"` / `"empty-grid"`），土方计算不再对非法多边形或空网格静默返回未标注的全 0 结果
- `CapabilityRegistry.updateAvailability(name, available, provider?)`：显式修改能力可用性
- `PluginScope.unmanage(resource)`：提前解除插件资源托管，配合 `manage()` 的幂等销毁契约
- `EngineContext.runWithIonToken(work, token?)` 实例级令牌合同：`@arc3dlab/engine-cesium` 新增 `createIonTokenRunner(instanceToken?)` 构造执行入口，`@arc3dlab/core` 新增容错封装 `runWithIonToken(context, work, token?)`（无引擎能力时直接执行）
- `AnalysisJobHost` 落地真实 Web Worker：`@arc3dlab/analysis` 的纯数值作业（矩形/多边形查询、面积、土方网格）在支持的环境投递到独立线程执行，跨线程错误经序列化还原并保留错误码，取消经 `Worker.terminate()` 抛 `CANCELLED`，无 `Worker` 环境自动降级进程内
- 新增 `AnalysisSampleBudget`、`yieldToEventLoop` 与 `YieldStrategy` 公共导出，供自定义任务复用任务级采样预算与块间让出
- 新增真实浏览器性能趋势场景 `e2e/perf.spec.ts` 与 `.github/workflows/perf.yml`（每日定时 + 手动），时间数值仅归档、资源回收做结构性断言
- `HeatmapOverlay.setGrid(grid, options)`：从已有 `HeatmapGrid` 直接渲染热力图，跳过网格计算，便于复用预计算结果；`setData` 保持不变并在内部委托 `setGrid`
- 新增 `.github/PULL_REQUEST_TEMPLATE.md`，将公共 API/SemVer 影响、生命周期与资源契约纳入合并前置检查

### chore

- `npm run build:watch` 现在会在每次 watch 重建后自动重跑 declaration rollup，保持开发期 `.d.ts` 与 JS 产物一致
- 登记自定义材质注册对 Cesium 内部入口 `Material._materialCache` 的依赖为升级高风险点（见 `COMPATIBILITY.md`），新增针对锁定版本的版本契约集成测试；升级 `cesium` 时须核查该内部结构
- 文档与发布合同同步：修正 `README.md`、`docs/guides/sdk-development.md`、`docs/guides/migration.md`、`docs/architecture/12-engineering.md` 中与 2.0.0 合同不一致的旧版兼容入口、版本号与 Cesium 依赖边界描述，并将本日志版本头由 `Unreleased` 归入 `v2.0.0`
- 最终产物同步：重生成 API 文档站并修正 `RadarNormalMaterialProperty.getValue` 的 JSDoc 告警；Sandcastle（`demo-vue3`）对齐身份为 `arc3dlab-sandcastle`、改为直接消费工作区 SDK 源码并移除过期的 `arc3dlab@^0.0.3` 依赖，重写其 README

## v1.0.0 - 2026-10-11

### feat

- 按分阶段方案全量迁移旧 LarkExplorer-SDK 能力（P0–P5）：核心几何与坐标基准（`geo` / `datum`）、交互事件与工具栏、场景视口度量与渲染后回调、兼容 `Map` 类
- 空间分析增强：`buffer`、`measure-tools`、`path`、`heatmap` / `dynamic-heatmap`、`flood` 洪水水面、`split` 卷帘；新增 `analysis:*` 能力
- 特效：`weather` 天气、`particles` 粒子、`materials` 扩展；新增 `effects:*` 能力
- 新增私有包 `@arc3dlab/plotting`：24 类军事标绘符号与纯几何算法；新增 `plotting:draw` 能力
- 动态图形与可视化：`graphics/dynamic`（7 类动态图元）、`voxel` 多瓦片体素、`flatten` 模型压平、`scene` 多屏联动 `SyncViewer` 与网格出图 `captureGrid`；新增 `graphics:*` / `scene:*` 能力
- 组件与数据：`@arc3dlab/ui` 导航条 `NavigationBar`、`@arc3dlab/data` 可注入 Web 服务提供者 `WebServiceProvider` / `createGaodeProvider` 与 `WebServiceManager`、`@arc3dlab/core` 高亮语义 `ActiveStyle`；新增 `data:web` / `ui:navigation` / `highlight:active` 能力
- 新增 VitePress **开发指南站**（`guide/`）：按类别分组（简介、运行时、相机、场景、影像地形、图层、图形、交互、分析、特效 UI、迁移能力、扩展与迁移）的 43 个章节，代码示例与实际公共 API 一致；`npm run guide:dev` / `guide:build` / `guide:preview`（独立端口 5175）
- 开发指南顶栏通过运行时计算兄弟端口，与 Sandcastle（5173）、API 文档（5174）互链；CI 新增 `guide` job 构建并上传 `guide-dist` 构件
- 新增 Cesium 风格 API 文档站：自研生成器（`typedoc --json` → normalize → render）替换 TypeDoc + Material 主题，覆盖 13 个包、JSDoc-default 结构类名与包命名空间侧边栏；`npm run docs:build` / `npm run lint:docs` / `npm run docs:preview`
- 全量补齐 13 个包公共导出的中文 TSDoc；公共符号摘要覆盖率 100%、参数覆盖率 100%，`lint:docs` 纳入 `gate` 与 CI
- 新增浏览器 E2E（Playwright + Chromium / SwiftShader）：`npm run test:e2e` 覆盖创建 → 添加 Graphic → 拾取 → 测量分析 → 销毁 → 重建；CI 增加独立 `e2e` job
- 新增覆盖率门禁 `npm run test:coverage`（v8，lines/statements 60、functions 58、branches 75），CI 增加最小权限 `contents: read`
- 默认底图改为外置 `globe.jpg` 资源按需加载，引擎 chunk 体积从约 126.8 kB 降至 9.3 kB；`lint:size` 增加必需资源存在性与大 base64 内联检查
- 新增 `app.scene.whenSceneReady()` 首屏就绪信号，返回 `SceneReadyResult`（`remainingTiles / timedOut / destroyed / defaultBaseLayer`），并派发 `sceneReady` 事件；导出 `SceneReadyOptions` / `SceneReadyResult` / `DefaultBaseLayerState`
- 内置分析新增任务化方法（`measure` / `terrain` / `visibility` / `query` / `volume.*Task`），返回统一 `AnalysisResult` 并登记到 `app.analysis.tasks`；导出 `createTaskExecutor` / `AnalysisTaskExecutor`
- 新增 bundle 体积门禁 `lint:size`（`bundle-baseline.json` + `scripts/check-bundle-size.mjs`）与依赖漏洞审计 `lint:audit`
- 公共 API 白名单扩展：Options / Event / 空间与数据语义 / `AnalysisTask` 等类型，根入口与 `@arc3dlab/sdk` 命名导出
- `Viewer`（兼容入口）标注 `@deprecated`，`Layers.get` 返回资源句柄
- 拆分 `graphics` / `layers` / `scene` 聚合源文件为职责单一模块（对外符号不变）
- 质量门禁新增 `lint:api`：禁止消费者深路径导入 `packages/*/src`
- Sandcastle 左侧底部显示运行控制台
- Sandcastle 示例通过 gui.addToolbarButton / addToggleButton / addToolbarMenu 在地球上创建交互控件

## v1.0.0-alpha.1 - 2026-10-08

### Breaking Changes

- 主入口切换为 `Arc3D.create()`
- `package.json` license 与 `LICENSE` 对齐为 GPL-2.0-only
- 移除源码内置 Cesium Ion / 天地图 Token

### feat

- 内部 packages 模块化：core / engine-cesium / scene / layers / graphics / data / interaction / analysis / effects / ui / sdk
- 引入 Arc3DApp、ResourceRegistry、EventBus、Lifecycle、CreditManager、RenderPolicy
- `Viewer` 降为兼容适配器
- 设计迭代文档：`docs/architecture/`
- `app.graphics.addModel` 加载 glTF 模型
- `app.data.createProvider` / `load` / `addKml` / `addCzml`
- Interaction：hover、pickGraphic、pickLayer、selection
- 测量：height / heading / horizontalDistance / verticalDistance / spaceAngle
- `app.effects.materials` Material Registry
- `app.analysis.terrain` 地形采样 / 坡度 / 剖面
- `app.analysis.visibility` 通视 / 径向视域
- `app.effects.postprocess` Bloom / Outline / DoF / Fog / ColorCorrection
- `app.analysis.query` 矩形 / 多边形 / 距离查询
- `app.analysis.clip` Plane / Box / Polygon 剖切
- `app.analysis.terrain.setExaggeration` 地形夸张
- `app.analysis.visibility.viewshed` 贴地可见包络
- `app.analysis.volume` 挖填方 / 开挖剖切

### fix

- addPoints 始终返回 Graphic
- Polygon Primitive 按 onGround 选择 GroundPrimitive / Primitive
- Polygon fill 与 outline 使用不同内部 ID，销毁时一起回收
- Imagery 同名添加先移除旧资源
- EventHandler 完整 destroy
- Tooltip 使用 textContent 与 canvas 相对坐标

### chore

- 移除旧 `src/core` / `src/utils` / `src/types` 封装实现与 Rollup 构建配置
- 固定 Cesium `1.146.0`
- Sandcastle playground 编辑器移到地球左侧
- 移除 `demo-html`，Playground 由 `demo-vue3` 承担
