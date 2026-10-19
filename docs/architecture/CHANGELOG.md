# 设计迭代日志

> 面向 SDK 维护者的架构、合同与质量门禁迭代记录，按日期倒序排列。
> 面向使用者的发布变更日志见根目录 `CHANGES.md`。

## 2026-10-18（稳定发布与 API 治理）

- 问题：公共 API manifest、打包 smoke 与四类产物（发布包 / API 文档 / 开发指南 / Sandcastle）已有基础门禁，但缺少发布分支合并后的版本/日志/迁移一致性检查，且 CI 未构建 Sandcastle；`test:pack` 也未验证许可文件归档与安装后依赖合同。
- API 治理：`lint:exports` 新增 manifest `entries` 与 `package.json.exports` 子路径双向一致性、顶层 `values` / `types` 与 `entries["."]` 一致性检查。
- 发布元数据：新增 `scripts/release-check.mjs` 与 `npm run release:check`（接入 `gate:release`），校验 semver、`package.json` / `package-lock.json` 版本、`CHANGES.md` 已发布小节与日期、`COMPATIBILITY.md` 活跃矩阵；含 `Breaking Changes` 时必须存在覆盖该版本的迁移说明；带 tag 检查时 `Unreleased` 必须已清空。新增 8 个单元测试。
- 打包合同：`test:pack` 校验 tarball 名称/版本、README/CHANGES/LOG/NOTICE/LICENSE 打包与安装内容一致、无源码路径泄漏，并校验安装后 `package.json` 的 ESM-only、无运行时依赖与精确 Cesium peer 合同。
- 同一提交产物：CI 新增 `sandcastle` job 构建并上传 `sandcastle-dist`；新增 tag 触发的 `release.yml`，在同一 commit 运行发布检查、`gate:release`、Chromium/Firefox E2E、Sandcastle 构建与 `npm pack`，归档 tarball / API 文档 / 开发指南 / Sandcastle。
- 验证：`release:check`、新增单测、`test:pack`、门禁脚本与工作流格式检查。

## 2026-10-18（Worker 空闲回收与跨浏览器 E2E）

- 问题：Worker 池中的槽位在作业完成后永久保留，多实例或一次性分析场景会持续占用线程与内存；浏览器 E2E 仅覆盖 Chromium，Worker 创建失败/禁用与重复创建销毁基线缺少真实浏览器回归。
- 空闲回收：`AnalysisJobHostOptions` 新增 `idleTimeoutMs`（默认 30000，`0` 禁用），空闲槽位超时后自动终止并移出池；回收定时器在 Node.js 中 `unref()`。新增诊断字段 `createdWorkers` / `reclaimedWorkers` / `peakWorkers` / `idleTimeoutMs`，并校验负数、非整数与无穷值。
- E2E：Playwright 新增 Firefox 项目，CI 安装 Chromium 与 Firefox；`worker-fallback` 场景在应用层分别模拟 `Worker` 不可用与构造器抛错，断言进程内降级、诊断计数与控制台无异常；`lifecycle-baseline` 场景连续三轮创建/分析/销毁，断言图形、注册表、跟踪器、活动 Worker 与待处理作业均回到基线。
- 验证：`analysis-worker` 新增空闲回收、禁用回收、超时前复用与非法参数测试；`npx tsc --noEmit`、相关 Vitest、Chromium/Firefox Playwright 与格式检查。

## 2026-10-18（四类产物最终同步）

- SDK 包：`npm run build` 重新产出 ESM、声明、Worker、source map 与静态资源；`scripts/publish-manifest.mjs` 的期望清单与 tarball 安装 smoke 覆盖全部入口；`files` 维持 `dist` 整树并排除声明中间目录。
- API 文档：`docs:build` 从当前源码重建 533 页 / 520 符号，`lint:docs` 维持 summary 100% / params 98.6%。
- Sandcastle：`demo-vue3` 通过 `vue-tsc -b` 与 Vite 生产构建；土方示例输出 `CutFillResult.terrain`，与 SDK 新字段同步。
- 开发指南：补充根入口分析作业公共导出、土方 `status` / `terrain` 字段与发布 `files` 整树策略，修正文档覆盖率描述；`guide:build` 通过。
- 记录：本条目与 `CHANGES.md` 的 `chore` 段登记本次同步；浏览器 E2E 覆盖分析 Worker、动态材质与场景就绪路径。

## 2026-10-18（架构边界与就绪/所有权合同补强）

- 目标：把 Cesium-first、运行时就绪、空间计算精度与公开对象生命周期四类边界写成可核对合同，减少“facade 就绪即资源可用”“经纬度 API 可承担测绘级转换”“句柄可重复卸载”等误读。
- Cesium-first：`01-principles.md` 的 Rule 4 登记 `Material._materialCache` 为唯一公开 API 例外并指向 `COMPATIBILITY.md` 风险登记；Rule 10 与 `guide/intro/what-is.md` 明确 `engine.type` 当前仅接受 `"cesium"`，RenderPolicy 是 Cesium 内的渲染路径选择，替换引擎需要新增适配层。
- 就绪语义：`README.md` 创建示例补充 `whenSceneReady()`；`guide/runtime/readiness.md` 新增资源就绪对照表，区分 facade、首屏、底图、地形、数据源、瓦片集、图形与分析结果，并说明 `ready: true` 不保证默认底图成功、`whenSceneReady()` 可在更换底图/地形后重复调用；`11-api.md` 同步同一判定。
- 精度边界：`guide/analysis/measure.md` 与 `09-analysis.md` 明确 WGS84 经纬度/椭球高输入、无投影与垂直基准转换、球面与局部平面模型适用范围、多边形拓扑假设、跨日界线处理范围、高纬/极点限制，以及测绘级成果需外部验证。
- 地形 no-data：`CutFillResult` 新增 `terrain.sampled` / `fallback` / `unavailable` 计数，`unavailable` 表示该网格点按椭球高 0 参与体积计算；`invalid-polygon` / `empty-grid` 返回全 0 计数。`analysis-volume` 新增不可用地形回归，避免把回退 0 当作真实测量。
- 生命周期：`11-api.md` 与 `guide/runtime/lifecycle.md` 新增所有权/释放/重复调用/重试表；`guide/plugins/plugins.md` 明确安装失败可重试、同名重复安装拒绝、重复卸载抛 `RESOURCE_NOT_FOUND`、作用域关闭后拒绝登记；`guide/runtime/lifecycle.md` 说明取消是终态与数据源失败记录的同 ID 重试。
- 验证：`npx vitest run tests/unit/analysis-volume.test.ts`；后续运行 `format:check`、typecheck、`docs:build`、`lint:docs`、`guide:build` 与相关门禁。

## 2026-10-18（数据源失败记录与重试合同）

- 问题：`DataManager.add()` 在加载前登记资产与 `loading` 图层；加载失败后保留 `failed` 记录，但相同 ID 重试会在 `registerAsset()` 处以 `DUPLICATE_RESOURCE` 失败。应用在加载期间销毁时，等待完成后的路径也未清理目录记录，可能遗留永久 `loading` 图层。
- 契约：加载失败继续保留 `failed` 图层与资产用于诊断；相同 ID 再次调用 `add()` 会先注销该失败记录，再按新资产重试；成功或加载中的同 ID 记录仍按重复资源拒绝。
- 回滚：加载成功后的视图登记、生命周期校验或注册表登记失败会注销图层与资产，并尽力移除已创建的数据源；注册表仅在本次登记成功后回滚，避免误删外部资源。加载期间应用销毁时，无论加载最终完成还是失败，目录记录都会回滚并以 `APP_DESTROYED` 结束。
- 验证：`data-manager-ownership` 覆盖失败后同 ID 重试、成功记录重复拒绝、销毁后加载完成/失败两条回滚路径，以及既有注册表登记失败回滚。

## 2026-10-18（场景形变监听器释放）

- 问题：`scheduleSceneRestore()` 的 `morphComplete` 回调触发后只设置 `cancelled`，未注销监听器；返回的 `cancel` 又因 `cancelled` 已为 `true` 直接返回，导致每次场景切换都留下一个失效但仍被事件源持有的回调。
- 修复：恢复回调执行前先调用注销函数，保证只恢复一次且监听器即时释放；若事件源在 `addEventListener()` 返回前同步触发，则在拿到注销函数后立即补调用。
- 验证：`scene-morph` 测试改为断言回调执行一次且注销一次，并新增注册阶段同步触发的回归用例；重复调用 `cancel` 不会重复注销。

## 2026-10-18（分析作业统一路由与 Worker 生命周期）

- 问题：`AnalysisJobHost` 仅作为内部能力存在，`AnalysisManager` 注入各服务的 `runTask` 直接调用 `runAnalysisTask`，`createTaskExecutor` 也只包装任务合同；纯数值分析虽已有 Worker 实现，却未从 `app.analysis` 的高层方法进入，Worker 生命周期也无明确所有者。
- 路由：`jobs.ts` 扩展纯数值作业类型（矩形/多边形/距离查询、面积、测量、土方网格）；`task-executor.ts` 的 `AnalysisTaskExecutor` 新增 `runJob`，`createTaskExecutor(context, { registry, host })` 把作业交给共享宿主；`AnalysisManager` 持有 `AnalysisJobHost`，测量、空间查询与 `cutFill` 网格构建经统一路由，`terrain.*` / `visibility.*` / 地形采样保持主线程。
- 生命周期：`AnalysisManager.destroy()` 调用 `jobHost.destroy()`，终止 Worker、拒绝未完成作业并清理监听；`app.destroy()` 既有分析销毁步骤自动覆盖。
- 输入边界：空间查询投递前把图形注册表投影为 `{ id, type, positions }` 快照；Viewer、Primitive、地形状态与闭包不进入 Worker。
- 公共 API：根入口与 `@arc3dlab/sdk` 导出 `AnalysisJobHost` / `executeAnalysisJob` 及作业类型，`scripts/public-api-manifest.json` 随刷新。
- 取消隔离：`AnalysisJobHost` 从单 Worker 改为最多 4 个槽位的 Worker 池，每个在途作业独占一个 Worker，完成后回池复用、超出容量排队；单项 `AbortSignal` 只终止该作业的 Worker，其他并发作业与排队作业不受影响。新增两个作业同时在途、仅取消其一的回归测试。
- 发布链路：`package.json` 的 `files` 改为发布 `dist` 整树并排除 `dist/src` / `dist/packages` 声明中间目录，source map、Worker、静态资源与后续嵌套 chunk 自动收录；`scripts/publish-manifest.mjs` 从构建产物收集期望清单，`scripts/pack-smoke.mjs` 逐项断言产物与 `exports` / `module` / `types` 入口都进入 tarball 并完成解压安装，同时从安装包 bundle 解析 Worker 引用，在消费者目录用真实 Worker 线程执行测量与面积作业。
- 发布合同：`checkPackageManifest` 纳入 `lint:exports`，持续校验 `type: module`、无 `main` / `require` 出口、`peer` / `dev` Cesium 精确为 `1.146.0`、Node `>=22` 与 `files` 完整策略；材质集成测试新增运行时 `Cesium.VERSION` 与 peer 版本一致性断言，浏览器 E2E 增加雷达/扩散材质的真实编译与绘制场景，二者继续由 CI 的 `gate` / `e2e` 任务覆盖。
- 验证：扩展 `analysis-task-services` / `analysis-worker` 测试，覆盖 Worker 路由、取消终止、`destroy()` 清理与场景依赖操作留在主线程。

## 2026-10-16（最终产物同步：API 文档 / Sandcastle / 开发指南）

- 目标：任务 1-16 改动完成后，对 SDK 包、API 文档、Sandcastle 与开发指南做最终一致性核对并保证四者可构建。
- API 文档：`npm run docs:build` 生成 533 页 / 520 符号、覆盖 12 个包命名空间；修复 `packages/graphics/src/dynamic/materials.ts` 中 `RadarNormalMaterialProperty.getValue` 的未使用 `@param time` 告警（形参为 `_time`），提取零告警；`npm run lint:docs` 覆盖率 summary 100.0% / params 98.6%。
- Sandcastle：校验示例中全部 `sdk.*` 引用（粒子工厂、动态图形工厂、`ModelFlatten`、`NavigationBar`、`captureGrid`、`createGaodeProvider`）均由各包 `src/index.ts` 导出；`package.json` 包名 `my-vue-app` → `arc3dlab-sandcastle`，删除过期的 `arc3dlab@^0.0.3` 依赖并将 `package-lock.json` 同步（示例经 `vite.config.ts` alias 直接消费工作区源码）；更新 `src/arc3dlab-shim.d.ts` 注释与 `README.md`。
- 开发指南：复核 `guide/` 源码未引用已移除 API（`Viewer` 仅存于迁移页），`PeerLinks.vue` 端口映射（5173/5174/5175）与 `11-api.md` 一致，`npm run guide:build` 通过。
- 公共 API：仅修正 JSDoc，无导出变更，`scripts/public-api-manifest.json` 未变。
- 验证：`npm run build`、`docs:build`、`lint:docs`、`guide:build`、`demo-vue3` 的 `npm run build` 均成功；`npm run gate:fast` 全绿（86 文件 / 571 通过 | 1 跳过）。需求与设计见 `.monkeycode/specs/2026-10-16-final-artifact-sync/`。

## 2026-10-16（文档与发布合同同步）

- 问题：根 `package.json` 已为 `2.0.0`，`@arc3dlab/legacy` 与根入口 `Viewer` / `Map` 已移除，SDK 采用 Cesium-first 定位；但 `README.md` 仍展示 `Viewer` 兼容示例，`docs/guides/sdk-development.md` 仍记录版本 `1.0.0`、`legacy/` 目录、`sdk -> legacy` 依赖与「Cesium 只出现在 engine-cesium」边界描述，`docs/architecture/12-engineering.md` 的 Active 矩阵仍为 `1.0.x`，`CHANGES.md` 用 `Unreleased` 承载已定版内容。
- 修复：`README.md` 旧入口示例改为「已在 2.0.0 移除」说明并指向 `docs/architecture/13-migration.md`；`sdk-development.md` 版本号统一为 `2.0.0`、删除 `legacy/` 与 `sdk -> legacy`、补 `plotting/`、依赖边界改为 Cesium-first 事实并引用 `03-engine.md` 与 `CESIUM_PACKAGES` 门禁、测试覆盖描述改为多包现状、发布示例改为 `v2.0.0`；`12-engineering.md` Active 矩阵改为 `2.0.x`；`docs/guides/migration.md` 增补移除状态声明。
- 版本日志：`CHANGES.md` 版本头 `Unreleased` → `v2.0.0`，并在 `chore` 段登记本次同步。
- 边界：迁移与历史文档中作为对照的 `1.0.0-alpha.1`、旧 `Viewer` 示例保留；不涉及导出变更，`scripts/public-api-manifest.json` 未变。
- 验证：检索确认旧版残留清除；`npm run format:check`。需求与设计见 `.monkeycode/specs/2026-10-16-doc-release-contract-sync/`。

## 2026-10-16（数值分析计算模型定位与地形状态）

- 问题：`packages/analysis/src/geometry.ts` 的 `geodesicDistanceMeters()` / `geodesicRingArea()` 实为半径取 WGS84 长半轴的球面公式，却被命名为 `geodesic`，`DistanceMode` / `AreaMode: "geodesic"` 让调用者误以为结果是 WGS84 椭球精确量；`toLocalMeters()` / `fromLocalMeters()` 把 `cos(lat)` 固定在投影原点，`buffer*`、土方网格与平面面积仅在小范围/非极区有效但未标注边界；`terrain.profile()` 丢弃采样 `source` / `status`，地形不可用（回退 0 米）与真实 0 米无法区分；`VolumeAnalysis.cutFill()` 对顶点不足或空网格静默返回未标注的全 0 结果。
- 计算模型字段（非破坏新增）：`units.ts` 新增 `ComputationModel`（`"ecef-chord"` / `"spherical"` / `"local-planar"` / `"ellipsoid-delta"`），`LengthResult` / `AreaResult` / `HeightResult` 各新增只读 `model`；`index.ts` 以 `modelForDistance()` / `modelForArea()` 从既有 `mode` 派生，单一真值来源；既有 `mode` / `units` / `heightDatum` / `reference` 语义与取值不变。
- 地形状态：`terrain.ts` 的 `ProfilePoint` 新增 `source` / `status`，`profile()` 的单点退化路径与多段路径均从 `sampleCartographics()` 结果透传，语义与 `terrain.sampleHeight()` 一致。
- 土方状态：`volume.ts` 新增 `CutFillStatus`（`"computed"` / `"invalid-polygon"` / `"empty-grid"`），`CutFillResult` 新增只读 `status`；非法多边形仍返回零值结果，仅新增可识别状态，不改变返回形态。
- 文档与 JSDoc：`docs/architecture/09-analysis.md` 新增「计算模型与适用边界」小节（各模型含义、适用边界与误差、`estimatedErrorCubicMeters` 为经验量级而非数学上界、高程基准仅椭球高且缺失按 0）；`geometry.ts` / `buffer.ts` / `cutfill.ts` 受影响函数 JSDoc 标注所属模型与边界。
- 退化输入：不改运行时，补单元测试固化——空数组、重复顶点、共线环、零长度线段、单点路径返回有限值或抛 `INVALID_ARGUMENT`，不产生 `NaN`。
- 公共 API：`@arc3dlab/analysis` 新增导出 `ComputationModel` / `CutFillStatus`，`scripts/public-api-manifest.json` 随刷新。
- 验证：扩展 `analysis-measure` / `analysis-terrain` / `analysis-volume` / `analysis-buffer` / `analysis-geometry` 测试；typecheck / 全量测试 / 门禁通过。需求与设计见 `.monkeycode/specs/2026-10-16-numeric-analysis-positioning/`。

## 2026-10-16（Cesium 内部材质缓存依赖治理）

- 背景：`registerArc3DMaterials()`（`packages/effects/src/materials.ts`）与 `registerRadarNormalMaterial()`（`packages/graphics/src/dynamic/materials.ts`）经 `Material._materialCache.addMaterial(...)` 注册自定义材质。`_materialCache` 是 Cesium 私有入口（`_materials` + `addMaterial` / `getMaterial`），Cesium 1.146.0 无公开替代，`Material.fromType` 亦消费同一缓存。已精确锁定 `cesium@1.146.0`，属升级高风险点而非当前必须重写。
- 风险登记：在 `COMPATIBILITY.md`「依赖锁定策略」下新增「Cesium 内部 API 依赖（升级高风险点）」，列出依赖清单、使用位置、原因、缓解（精确锁定、`if (!cache) return` 守卫、版本契约测试、升级核查），并声明其不属于稳定公开合同。
- 架构说明：`docs/architecture/10-effects-ui-plugin.md` 补充内置材质注册依赖内部入口并引用风险登记。
- 版本契约集成测试：新增 `tests/integration/cesium-material-registration.test.ts`（3 项）——探针 `Material._materialCache` 结构与 `addMaterial` / `getMaterial`；断言动态扩散、线尾迹、雷达三类模板进入缓存且 `fabric.type` / `fabric.source` 正确；对无纹理材质复用 Cesium 真实 `Material.fromType` 编译并断言 `shaderSource` 含 `czm_getMaterial`。node 下 `getUniformType` 会 `instanceof` 浏览器构造器，测试在 `beforeAll` 注入占位类、`afterAll` 还原；线尾迹的 `image` 纹理路径触发浏览器纹理加载，留待 E2E 层。
- 验证：`npx vitest run tests/integration/cesium-material-registration.test.ts` 3 项通过；全量门禁通过。需求与设计见 `.monkeycode/specs/2026-10-16-cesium-material-cache-risk/`。

## 2026-10-16（Credits 展示模式布局与位置可逆）

- 问题：`packages/engine-cesium/src/credits.ts` 的 `CreditManager.setMode()` 把「布局压缩」与「版权是否显示」混在一起——`compact` 直接对 `viewer.cesiumWidget.creditContainer` 设 `display: none`，连同第三方数据源署名一起隐藏；`custom` 把容器 `appendChild` 到业务节点后，切回 `default` 只把 `display` 置空，容器仍留在自定义节点内，原始位置未恢复，`getContainer()` 语义随之混乱。自定义容器判定用 `container instanceof HTMLElement`，在无 DOM 环境不可测。
- 拆分合同：`default` 与 `compact` 均保留版权信息，只区别布局；`compact` 以 `fontSize` / `lineHeight` / `padding` 压缩占位，不再改写 `display`。构造时缓存 `creditContainer`、其 `parentNode`（`originalParent`）与基线 `display`。
- 可逆切换：每次 `setMode` 先 `restore()`——若容器已不在原始父节点则 `appendChild` 移回，`display` 恢复基线值，清空压缩样式——再按目标模式施加最小改动；`custom` 记录 `customContainer` 并挂载，未提供可挂载容器时自然落入 `default` 表现。`getContainer()` 返回 `customContainer ?? creditContainer`。
- 挂载判定：以 `isMountable()`（具备 `appendChild` / `removeChild`）替代 `instanceof HTMLElement`，兼容 `SVGElement` 等非 `HTMLElement` 的 `Element` 并支持无 DOM 单测。
- 验证：新增 `tests/unit/engine-credits.test.ts`（5 项），用最小假 DOM 覆盖 `compact` 不隐藏且压缩、`custom` 挂载与 `default` 归位、完整 `default → custom → compact → default` 流程、保留既有基线 `display`、无容器回退；typecheck / 全量测试 / 门禁通过。需求与设计见 `.monkeycode/specs/2026-10-16-credit-mode-layout/`。

## 2026-10-16（动态材质跨日时间与相等性）

- 问题：`packages/effects/src/materials.ts` 的 `DynamicSpreadMaterialProperty` / `PolylineTrailMaterialProperty` 以 `epoch = time.secondsOfDay` 记录动画起点并计算 `(time.secondsOfDay - epoch)`。`secondsOfDay` 取值 `[0, 86400)`，每天午夜回绕，跨日动画的差值突变甚至为负，动画重置或倒退；且 `epoch` 若保存的是调用方传入的 `JulianDate` 引用，会随 `viewer.clock.currentTime` 的就地推进而漂移。两类材质的 `equals()` 只比较颜色与 `gradient` / `image`，遗漏 `duration`。
- 时间合同：改用 `JulianDate.secondsDifference(time, epoch)`（按 `dayNumber` 与 `secondsOfDay` 联合求差，跨日连续），`JulianDate` 由 `type` 导入改为值导入；`epoch` 用 `JulianDate.clone(time)` 保存独立副本，避免引用漂移。`time` 的「周期数」语义与默认 `duration = 1000` 不变。
- 相等性合同：`DynamicSpreadMaterialProperty.equals()` 增加 `duration` 比较，`PolylineTrailMaterialProperty.equals()` 增加 `duration` 比较，覆盖全部影响结果的字段。
- 验证：扩展 `tests/unit/effects-material-properties.test.ts`（跨午夜单调、epoch 快照不受传入实例就地修改影响、`duration` 差异判不相等），共 11 项；typecheck / 全量测试 / 门禁通过。需求与设计见 `.monkeycode/specs/2026-10-16-dynamic-material-time-crossday/`。

## 2026-10-16（动态热力图网格复用与插值播放）

- 问题：`packages/analysis/src/dynamic-heatmap.ts` 的 `DynamicHeatmapOverlay.setFrames()` 为每帧预计算并缓存网格、并导出了 `interpolateHeatmapGrid()`，但 `showFrame()` 仍把原始点集交给 `HeatmapOverlay.setData()` 重算网格，`play()` 也只是定时调用 `showFrame(current + 1)` 逐帧硬切；预计算与插值能力双双闲置，同一帧被重复计算、动态过渡不连续。
- 渲染/计算解耦：`HeatmapOverlay` 新增 `setGrid(grid, options)` 直接从网格渲染（仅 `gridToRgba` + canvas + 实体，不做网格计算）；`setData(points, options)` 保留生命周期断言，内部改为 `setGrid(computeHeatmapGrid(points, options), options)`，可观察结果与既有实现一致。
- 帧渲染：`showFrame(index)` 改为 `overlay.setGrid(this.grids[current], frame.options)`，命中 `setFrames` 预计算网格，不再对点集重算。
- 插值播放：`play(intervalMs, steps)` 把每个帧间隔拆为 `steps`（默认 `DEFAULT_TRANSITION_STEPS = 12`）个子步，子步时长 `max(16, round(duration / max(2, floor(steps))))`；过渡期内渲染 `interpolateHeatmapGrid(grids[from], grids[to], ratio)` 并沿用起始帧渲染选项，`ratio >= 1` 时渲染目标帧、`current` 前进、`elapsed` 归零；相邻网格维度不一致时 `interpolateHeatmapGrid` 既有回退返回起始网格，间隔结束仍以目标帧切换；`pause()` / `clear()` 停止定时器，帧数不足 2 时不启动。
- 公共 API：`HeatmapOverlay.setGrid` 为新增方法，`interpolateHeatmapGrid` / `DynamicHeatmapFrame` / `DynamicHeatmapOverlay` 导出保持不变，`scripts/public-api-manifest.json` 随刷新。
- 验证：扩展 `tests/unit/analysis-heatmap.test.ts`，以原型 spy 隔离 DOM，断言 `showFrame` 命中缓存网格且不调用 `setData`（不重算），并断言 `play` 在相邻网格间按比例插值、间隔末切换到目标帧、`pause()` 后不再推进；typecheck 通过，`interpolateHeatmapGrid` 数学正确性沿用既有纯函数用例。需求与设计见 `.monkeycode/specs/2026-10-16-dynamic-heatmap-grid-playback/`。

## 2026-10-16（分块分析让出、采样预算与真实 Worker）

- 问题：`packages/analysis/src/scheduler.ts` 的 `mapInChunks()` 块间仅 `await Promise.resolve()` 微任务让出，不进入下一轮事件循环，长分析（可视域、地形剖面、规模采样）阻塞渲染帧与输入；`maxSamples` 只在单次调用内生效，可视域这类多子操作任务按子操作各自限额，累计采样可远超预期；`worker-host.ts` 的 `AnalysisJobHost` 名为 Worker 宿主却用 `queueMicrotask` 进程内同步执行，`jobs.ts` 的纯数值作业仍占用主线程。
- 让出合同：新增 `yieldToEventLoop(strategy)`，缺省真实宏任务让出（`MessageChannel`，不可用时 `setTimeout(0)`），`"microtask"` 保留微任务让出；`AnalysisTaskOptions` 新增 `yieldStrategy`，`mapInChunks()` 与 `sampleCartographics()` 的分块循环统一经该函数让出（后者由单次映射改为按 `DEFAULT_CHUNK_SIZE` 分块）。
- 预算合同：新增 `AnalysisSampleBudget`，以任务级累计采样数为口径，`reserve(count)` 超限抛 `Arc3DError("INVALID_ARGUMENT")` 且不改变已消耗量；`AnalysisTaskOptions` 新增 `sampleBudget`；`viewshed` 创建单一预算实例并由观察点与全部射线共享（`lineOfSight` 拆出内部 `computeLineOfSight(options, budget?)`，公共签名不变）；未提供共享预算的单次调用以本次坐标数为上限，保持既有单次截断行为且不抛超限错误。
- Worker 合同：新增 `worker-protocol.ts`（错误与消息编解码、最小 `AnalysisWorkerLike` 接口、`AnalysisWorkerFactory`）与 `analysis-worker-entry.ts`；`AnalysisJobHost` 改为 `AnalysisJobHostOptions` 构造（`execute` / `createWorker`），在提供 `Worker` 的环境把纯数值作业投递到独立线程并以 `id` 路由回复，不可克隆输入在投递前抛 `INVALID_FORMAT`，跨线程错误经 `restoreAnalysisError` 还原错误码，取消经 `terminate()` 抛 `CANCELLED` 并允许下次重建 Worker，无 `Worker` 或创建失败时降级进程内执行；`vite.config.ts` 增加 `worker: { format: "es" }`。
- 公共 API：`@arc3dlab/analysis` 新增导出 `yieldToEventLoop` / `AnalysisSampleBudget` / `YieldStrategy` / `AnalysisJobHostOptions` / `AnalysisWorkerLike` / `AnalysisWorkerFactory`；`serializeAnalysisError` / `restoreAnalysisError` 迁入 `worker-protocol` 后仍经 `worker-host` 转出，导入路径不变；`scripts/public-api-manifest.json` 随刷新。
- 验证：新增 `tests/unit/analysis-scheduler.test.ts`（预算累加/超限/不改变已消耗量、宏任务与微任务让出顺序），扩展 `tests/unit/analysis-worker.test.ts`（注入假 Worker 验证投递/错误还原/`INVALID_FORMAT`/取消 `terminate`/取消后重建/销毁）与 `tests/unit/analysis-visibility.test.ts`（共享预算超限、跨块采样顺序与数量）；全量 84 文件 / 548 通过 | 1 跳过；门禁 typecheck / 全量测试 / deps / exports / license / api / format:check 通过，`lint:size` 与 `lint:docs` 随构建验证。需求与设计见 `.monkeycode/specs/2026-10-16-scheduler-yield-budget/`。

## 2026-10-16（空间参考等价性分层与长度单位校验）

- 问题：`packages/core/src/spatial.ts` 的 `sameSpatialReference()` 比较 `crs` / `axisOrder` / `angularUnit`，未比较 `linearUnit`。相同 CRS 但高程单位不同（米/英尺）时仍判为等价，导致 `tryCreateCoordinateTransform()` 返回恒等转换，单位换算被静默遗漏；水平与垂直方向的等价性也未分层，且缺少「真实变换不支持时明确报错」的入口。
- 合同：把空间参考等价性分为水平（`crs` / `axisOrder` / `angularUnit`）与垂直（`datum` / `geoidModel` / `linearUnit`）两层；完整等价 = 水平等价 且高程长度单位等价（缺省 `meters`）；仅完整等价才返回恒等转换。
- 新增 `sameHorizontalReference()` / `sameVerticalReference()` 分层判断；`sameSpatialReference()` 纳入 `linearUnit`；`tryCreateCoordinateTransform()` 对单位差异返回 `undefined`；新增 `createCoordinateTransform()`，不完全等价时抛 `Arc3DError("UNSUPPORTED_CAPABILITY")`，错误信息经 `describeSpatialMismatch()` 点明差异层次（CRS / 轴序 / 角度单位 / 长度单位）。
- 恒等转换改为携带调用传入的真实 `source` / `target`（新增内部 `makeIdentityTransform()`），`identityTransform(reference)` 行为不变。
- 验证：`tests/unit/spatial-reference.test.ts` 扩充至 10 项，覆盖长度单位差异、分层等价、缺省 `meters`、恒等转换携带真实参考、显式报错含源/目标 CRS；typecheck / 全量测试 / deps / exports / license / api / format:check 全通过。需求与设计见 `.monkeycode/specs/2026-10-16-spatial-unit-equivalence/`。

## 2026-10-16（标绘创建 ID 校验与原子化）

- 问题：`PlottingManager.draw()`（`packages/plotting/src/plotting-manager.ts`）先用 `shapes.map((shape) => this.materialize(...))` 创建底层实体，再构造 `PlotResult` 并 `items.set(id, result)`。一个符号可产出多个图元（如 `circle` / `flag` / `formation` 等面状符号同时生成面与轮廓），若第 N 个 `materialize` 抛错，前 N-1 个实体既无记录也不会被清理，成为不可追踪的孤儿实体；同时 `items.set` 会覆盖同 ID 的既有记录，而旧记录的实体仍在场景中，`remove()` / `removeAll()` 无法再完整清理。
- 合同：ID 在创建任何实体之前校验；创建过程使用本地暂存集合，全部成功后再原子提交记录；任一步失败回滚本次已创建实体、不写入记录并原样重抛。
- ID 校验顺序固定为「几何合法性 → ID → 实体创建」：`resolveId()` 对显式空字符串抛 `INVALID_ARGUMENT`、未提供时 `createId("plot")`；`claimId()` 对重复 ID 抛 `DUPLICATE_RESOURCE`，语义与 `GraphicManager.claimId` 一致。
- 回滚与移除路径统一：新增 `disposeEntities()`，`remove()` 与创建失败回滚共用同一实现，释放时经 `viewerOrUndefined()` 容错视图不可用。
- 验证：`tests/unit/plotting.test.ts` 扩充至 15 项，覆盖重复 ID 拒绝（既有记录与实体不受影响）、空 ID 拒绝、多图元符号中途失败回滚（`failOnAdd` 注入）、成功提交后 `removeAll()` 完整清理；typecheck / 全量测试 / deps / exports / license / api / format:check 全通过。需求与设计见 `.monkeycode/specs/2026-10-16-plot-draw-atomicity/`。

## 2026-10-16（资源生命周期与状态管理统一合同）

- 问题：多子系统创建原生 Cesium 资源但所有权与释放路径不统一——`GraphicManager.addVoxel` / `addFlatten` 返回的 `MultiTileVoxel` / `ModelFlatten` 未登记进 `context.registry` 也不在 `GraphicManager.clear()` 中（`clear()` 只遍历 `this.items`）；`EffectsManager.destroy()` 不释放粒子且 `ParticleManager` 无托管与 `destroy()`；`createBaseSystem` 无条件把 `viewer.clock.shouldAnimate` 置为 `true` 且不恢复；`SceneController.sync()` 返回的 `SyncViewer` 不被跟踪，场景销毁不解除相机监听；`DataManager.add()` 句柄注销图层但不注销 `registerAsset` 的资产；`ManagedGraphic.positions` 直接返回内部数组引用。
- 三类所有权合同：**SDK 完全拥有**（图形、粒子、体素/压平，Manager 统一登记，单对象或应用级销毁，重复销毁安全）；**SDK 暂时管理的外部对象**（外部瓦片集/裁剪目标，`ModelFlatten` 仅在目标槽位仍指向自有集合时解除关联）；**应用级共享状态**（`viewer.clock.shouldAnimate` 覆盖前保存原值、引用计数归零恢复）。
- 体素/压平：`MultiTileVoxel` / `ModelFlatten` 实现 `ResourceHandle`（新增 `id` / `type` / `owned` / `native` / `visible`），`GraphicManager.addVoxel` / `addFlatten` 经 `registerAtomically` 登记进共享注册表并记入内部 `extras`；`clear()` 经 `registry.remove` 释放 `extras`；创建前 `lifecycle.assertUsable` 失败抛 `APP_DESTROYED`。
- 粒子与时钟：`ParticleManager` 新增托管集合、`size` 与 `destroy()`（单句柄失败经 `logger.error` 上报不中断其余释放），`EffectsManager.destroy()` 追加 `particles.destroy()`；`particles.ts` 新增模块级 `WeakMap<Viewer, { original, count }>`，`acquireClockAnimation(viewer)` 首次覆盖 `shouldAnimate` 并保存原值、计数归零时恢复并清理，释放函数幂等并并入 `ParticleHandle` 的 `detach`。
- 场景与数据：`SceneController` 新增 `syncViewers` 集合并随 `destroy()` 释放全部 `SyncViewer`（幂等，兼容 disposers 与应用级两步销毁）；`DataManager.add()` 句柄 `onDestroy` 与注册表登记失败回滚分支均追加 `catalog.unregisterAsset(id)`；加载失败时保留一致的失败记录（图层 `failed` + 资产），避免图层悬挂引用不存在的资产。
- 图形坐标：`ManagedGraphic` 构造与 `positions` getter 均返回/保存独立副本，外部原地修改不再绕过变更通知。
- 验证：新增 `tests/unit/graphics-resource-ownership.test.ts`（7 项）与 `tests/unit/data-manager-ownership.test.ts`（2 项），扩展 `tests/unit/effects-particles-manager.test.ts`（托管释放、引用计数时钟、手动销毁不重复释放）与 `tests/unit/scene-sync-shotgrid.test.ts`（场景销毁解除联动监听）；全量 83 文件 / 525 通过 | 1 跳过；门禁 typecheck / deps / exports / license / api / format:check / lint:size / lint:docs 全通过；需求与设计见 `.monkeycode/specs/2026-10-16-resource-ownership/`。

## 2026-10-16（裁剪分析所有权与状态一致性）

- 问题：`ClipAnalysis`（`packages/analysis/src/clip.ts`）`setExcavation()` 在顶点少于三个时只清空内部 `active` 并记录空结果，不撤销已应用的裁剪，导致 `list()` 为空而场景仍存在旧裁剪；`clearPolygons()` 替换 `globe.clippingPolygons` 不释放被替换集合，`setPolygon()` / `setExcavation()` 直接改写共享槽位；`clear()` / `destroy()` 无条件清理 Globe 裁剪，可能破坏调用者或其它子系统设置的状态。
- 所有权模型：首次写入前 `captureBaseline()` 记录 `globe.clippingPlanes` / `globe.clippingPolygons`；`applyClip()` 与 `resetToBaseline()` 统一挂载与释放，只释放自有集合，未使用的槽位恢复基线；`resetToBaseline()` 在从未写入时不触碰 Globe。平面集合以 `destroy()` 释放，多边形集合（Cesium 1.145+ 不再持有 GPU 资源）仅解除引用；平面槽位恢复前用 `isDestroyed()` 过滤已被 Cesium 槽位替换语义销毁的基线，多边形槽位恢复失败时回退清空以避免所有权校验异常。
- 输入校验：新增 `assertPolygon()`，`setPolygon()` / `setExcavation()` 在少于三个顶点时于任何场景变更前抛 `Arc3DError("INVALID_ARGUMENT")`，旧裁剪与 `list()` 保持有效。
- 验证：重写 `tests/unit/analysis-clip.test.ts`（12 项），覆盖记录/启用、无效输入不改状态与写入计数、自有平面集合替换/释放、平面与多边形基线捕获与恢复、基线不被释放、模式切换、从未使用不触碰 Globe；需求与设计见 `.monkeycode/specs/2026-10-16-clip-ownership/`。

## 2026-10-15（Cesium Ion 令牌实例级合同）

- 问题：Ion 影像（`packages/data/src/providers.ts`）直接调用 `IonImageryProvider.fromAssetId(spec.assetId)`，未进入令牌作用域；`EngineViewerOptions.ionToken` 虽由 `Arc3D.buildApp` 从 `engine.cesium.ionToken ?? tokens.cesiumIon` 解析并传入 `createCesiumEngineContext`，却未被任何路径应用，导致配置的实例令牌对 Ion 影像无效。地形与 Tileset 各自 `readIonToken` + `withIonAccessToken`，路径分散。
- 合同：`EngineContext`（core）新增可选 `runWithIonToken(work, token?)`（类型 `RunWithIonToken`），语义为应用实例令牌（被 `token` 覆盖）、保证并发按串行顺序设置与恢复、在工作结束（含异常）后恢复全局令牌；core 新增容错封装 `runWithIonToken(context, work, token?)`，无能力时直接执行。
- 引擎绑定：`packages/engine-cesium/src/ion.ts` 新增 `createIonTokenRunner(instanceToken?)`，返回在共享串行作用域内执行 `withIonAccessToken(token ?? instanceToken, work)` 的入口；`createCesiumEngineContext` 以 `createIonTokenRunner(options.ionToken)` 绑定。
- 数据层：`createImageryProvider` / `createProviderHandle` 第二参数由 `fallbackToken: string` 改为 `ProviderOptions { tdtToken?, runWithIonToken? }`；Ion 分支在 `options.runWithIonToken(create, spec.token)` 内创建，缺入口时直接创建，`spec.token` 作为覆盖令牌；`ProviderSpec` 缺失 `assetId` 仍抛 `INVALID_ARGUMENT`。
- 调用方收敛：`ImageryOverlayManager.add`、`BasemapManager.set`、`DataManager.createProvider` 传入 `runWithIonToken: (work, token) => runWithIonToken(context, work, token)`；`TerrainManager.set`（ion）保留 `readIonToken` 用于 `AUTH_FAILED` 校验并经同一入口执行；`TilesetManager.add`（assetId）直接经同一入口执行。业务模块不再直接组合 `readIonToken` 与 `withIonAccessToken`。
- 公共 API 基线 `scripts/public-api-manifest.json` 随 `./engine-cesium` 新增 `createIonTokenRunner` 刷新；新增 `tests/unit/ion-imagery-token.test.ts` 覆盖 runner 令牌应用/覆盖/恢复、Ion 影像经入口创建与 `spec.token` 覆盖、无入口与缺 `assetId` 分支、core 封装的有无能力行为；需求与设计见 `.monkeycode/specs/2026-10-15-ion-token-contract/`。

## 2026-10-15（网格出图的渲染同步与状态恢复）

- 问题：`captureGrid()`（`packages/scene/src/shot-grid.ts`）逐块 `setView` → 可选 `delayMs` → `canvas.toDataURL()`，默认 `delayMs` 为 0 时不请求也不等待渲染帧，按需渲染下可能导出上一视图；且未保存/恢复相机，正常完成停留最后一幅、异常路径不恢复。
- 渲染同步：新增 `awaitFrame(viewer, timeoutMs)`，先 `viewer.render()` 强制渲染一帧，再在 `scene.postRender` 可监听时注册一次性监听并 `scene.requestRender()` 等待信号，超过 `renderTimeoutMs`（默认 `1000`）兜底；缺少能力时立即采集。`delayMs` 保留为渲染完成后的追加等待。
- 状态恢复：出图前经 `captureCameraState()` 保存 `positionWC` 与 heading/pitch/roll，`finally` 中 `restoreCameraState()` 恢复并 `scene.requestRender()` 刷新；通过既有 `EngineViewer.acquireContinuousRender("shot-grid")` 持有持续渲染需求并在 `finally` 释放。
- 参数约束：`assertGridShape()` 要求 `rows` / `columns` 为 `≥ 1` 的整数，`rows × columns` 不得超过 `maxShots`（默认 `64`），失败抛 `Arc3DError("INVALID_ARGUMENT")` 且在任何相机变更之前。
- 验证：扩展 `tests/unit/scene-sync-shotgrid.test.ts`，覆盖每幅渲染请求、正常/异常相机恢复、非法行列数、分幅上限与覆盖、超时兜底；需求与设计见 `.monkeycode/specs/2026-10-15-shot-grid-capture/`。

## 2026-10-15（体素数据合同与空间插值）

- 问题：`MultiTileVoxel`（`packages/graphics/src/voxel.ts`）的 `sampleGrid()` 返回 `(cx + cy + cz) / (dimensions * 3)`，采样值只由网格索引决定，与 `pointData` 无关；`interpolate()` 把经纬度“度”与高程“米”直接做欧氏距离；`buildPrimitive()` 的垂直跨度误用数值范围 `maxValue - minValue`。核心输出未表达输入数据空间分布。
- `VoxelOptions` 扩展：`method`（`idw` 默认 / `nearest`）、`power`（默认 `2`）、`padding`（默认 `0`）；新增 `VoxelInterpolationMethod` 类型导出。
- 采样：新增 `sampleAt()`，IDW 权重为距离倒数的 `power` 次幂，重合距离直接返回点值；距离在盒中心 ENU 米制坐标系计算，经度按 `cos(centerLat)` 折算（`METERS_PER_DEGREE_LATITUDE = 110540` / `METERS_PER_DEGREE_LONGITUDE = 111320`）。
- 几何：`computeBounds()` 计算有效点 WGS84 边界与盒中心；垂直跨度取高程跨度；节点索引 `[0, dimensions - 1]` 线性映射到边界并由端点节点覆盖；零跨度维度使用 `MIN_AXIS_SPAN = 1` 米。
- 缺失值：`value = NaN` 视为缺失，排除出边界、定义域与插值；节点无有效输入输出透明颜色 `(0, 0, 0, 0)`，`interpolate` 返回 `NaN`。
- 颜色：定义域取自有效采样值 `[min, max]`，高值映射 `colorsList` 首项、低值映射末项；`colorForValue` 改为接收显式定义域。
- 验证：新增 `tests/unit/graphics-voxel-interpolation.test.ts`（常量保持、IDW 权重解析解、重合命中、nearest、NaN 排除、数据依赖、颜色端点、透明、垂直跨度、padding、空集、`dimensions: 1`）；更新 `tests/unit/graphics-voxel-flatten.test.ts` 增加数据依赖断言；需求与设计见 `.monkeycode/specs/2026-10-15-voxel-data-contract/`。

## 2026-10-15（默认占位底图与业务底图协调）

- 问题：默认占位底图（外置 `globe.jpg`）与业务自定义底图共用 Cesium 影像集合最底层槽位。`BasemapManager.set()` 先 `addImageryProvider(provider, 0)` 再 `lowerToBottom()`，而引擎侧占位图也插入索引 0；两者异步插入时机不同会互相覆盖，出现“业务底图被默认占位图盖住”。
- `EngineViewer` 合同新增可选 `setDefaultBaseLayerVisible(visible)`。
- 新增 `packages/engine-cesium/src/default-base-layer.ts` 的 `DefaultBaseLayerController`：以“期望可见性”状态驱动占位图，`attach()` 时按最新期望生效，天然覆盖“占位图先完成”与“业务底图先完成”两种时序；`CesiumEngineViewer` 委托其管理，`destroy()` 时 `clear()`。
- `BasemapManager` 在 `set()` 成功后隐藏占位图、失败或销毁当前底图时恢复；替换底图时先置空 `current` 再销毁旧图层，避免占位图被短暂恢复。
- 公共 API 基线 `scripts/public-api-manifest.json` 随 `CesiumEngineViewer` 签名刷新；新增 `tests/unit/engine-default-base-layer.test.ts` 与 `tests/unit/layers-basemap.test.ts`。

## 2026-10-15（按需渲染与动态效果协调）

- 引擎默认按需渲染（`requestRenderMode = true` + `maximumRenderTimeChange = Infinity`）会抑制纯模拟时间驱动的刷新，导致雨雪/闪电、粒子、依赖 `czm_frameNumber` 的自定义材质在静态场景下停滞。
- `EngineViewer` 合同新增可选 `setRequestRenderMode(enabled)` 与 `acquireContinuousRender(reason)`；`@arc3dlab/core` 提供容错封装 `acquireContinuousRender(context, reason)`，无引擎环境返回空释放。
- 新增 `packages/engine-cesium/src/render-mode.ts` 的 `RenderModeCoordinator`：以基准按需模式 + 持续渲染需求计数计算实际模式，存在需求时强制持续渲染，全部释放后自动回到按需渲染；`CesiumEngineViewer` 委托其管理，`destroy()` 时 `dispose()`。`RenderController` 增加 `acquireContinuousRender(reason)` 并新增 `requestRenderMode` 只读 getter。
- 自动接入：`WeatherEffects`（rain/snow/lightning）、粒子系统、`graphics/dynamic` 动画句柄（扩散点/雷达/水系/圆形扩散/动态折线）、`FloodAnalysis` 水面；静态图元与 fog 不占用需求。
- 公共 API 基线 `scripts/public-api-manifest.json` 随 `CesiumEngineViewer` 签名刷新；新增 `tests/unit/engine-render-mode.test.ts` 并在 weather/particles/graphics/analysis-flood 测试中补充需求计数断言。

## 2026-10-12（旧版内容收敛：移除 legacy 兼容资产）

- 移除根入口 `Viewer` / `Map` 与 `LegacyViewerOptions` / `LegacyMapOptions` 导出，删除 `@arc3dlab/legacy` 包，并同步清理 `tsconfig.json` / `typedoc.json` / `scripts/api-docs/config.mjs` / `packages/README.md` 与 `demo-vue3`、`e2e` 构建别名。
- 移除 `Arc3DPlugin.dependsOn` 废弃字段与插件安装回退解析，能力依赖统一走 `requiresCapabilities`；`examples/domain-plugins/mining-plugin.ts` 同步更新。
- 移除 `@arc3dlab/analysis` 的 `AnalysisWorkerHost` 兼容别名，统一使用 `AnalysisJobHost`；`tests/unit/analysis-worker.test.ts` 同步更新。
- 公共 API 基线 `scripts/public-api-manifest.json` 重新生成；`COMPATIBILITY.md` 补充 1.x → 2.0 迁移窗口与移除清单。
- 需求与设计：新增 `.monkeycode/specs/2026-10-12-legacy-content-sunset/`。

## 2026-10-12（第三轮审阅整改：owner 授权、注册表快照与清理收敛）

- 插件归属：取消注册表的隐式 `ownerProvider`（全局活动 owner）推断；`CommandBus` / `ToolRegistry` / `CapabilityRegistry` 构造不再接收 ownerProvider，默认 owner 收敛为 `spec.plugin` 仅作归属记录。保留命名空间（`core.` / `arc3dlab.`）授权改为只依据显式 owner，自报 `plugin` 不再能占用保留前缀；`createCoreCommandBus()` 显式以 `"core"` 注册 `core.ping`。
- 注册表不可变性：`CommandBus.get()` 返回防御性快照（含 `params` / `dependsOn` 深拷贝）；`CapabilityRegistry.get()/records()` 返回副本，可用性只能经新增 `updateAvailability(name, available, provider?)` 修改。
- 清理容错：`ResourceRegistry.clear()` 与 `DisposerStack.disposeAll()` 的错误上报回调包裹 `try/catch`，上报器抛错不再中断剩余释放；`Arc3DApp` 与 `plugins.ts` 分别经 `logError()` / `safeLog()` 统一 best-effort 日志。
- 工具状态机：`ToolRegistry.activate()` 在旧工具 `deactivate()` 抛错时回滚 `active`/`current` 为 active 后再抛出，保证状态收敛。
- 数据 schema 生命周期：`DataCatalog` 引入 `schemaOwners`，资产拥有的 schema 随资产注销移除；新增 `registerSchema` / `hasSchema` / `unregisterSchema`，被存活资产拥有的 schema 拒绝独立注销。
- 插件资源托管：`DisposableResource.destroy()` 幂等列为公开契约；`PluginScope.manage()` 以幂等 disposer 托管并新增 `unmanage()` 支持提前解托管。
- 性能证据分层：保留 `bench:check` 为合成 micro-benchmark；新增 `e2e/perf.spec.ts` 真实浏览器场景与 `.github/workflows/perf.yml`（每日定时 + 手动）趋势任务，时间数值仅归档、资源回收做结构性断言。
- 发布治理：新增 `.github/PULL_REQUEST_TEMPLATE.md`，`12-engineering` 增补“公共 API 与 SemVer 治理”；`scripts/public-api-manifest.json` 随 API 变更刷新。
- 开发期一致性：`vite.config.ts` 增加内联插件，`npm run build:watch` 在每个 watch 重建后自动重跑 declaration rollup（`scripts/rollup-dts.mjs`），避免开发期 `.d.ts` 与 JS 产物漂移。
- 分析文档：`09-analysis.md` 补充输入快照合同（默认克隆、不可克隆降级告警与 `snapshot` 钩子边界）。
- 新增/更新测试：`registry-immutability.test.ts`、`plugin-owner-isolation.test.ts`、`plugin-extensions.test.ts`、`tools-registry.test.ts`、`data-catalog.test.ts`、`plugin-managed-resources.test.ts`、`core-runtime.test.ts`、`plugins.test.ts`、`plugins-concurrency.test.ts`；`npm run gate:release` 与 `npm run test:e2e` 全绿。

## 2026-10-12（第二轮审阅整改：生命周期、数据语义与发布合同）

- 生命周期与并发：`PluginManager` 引入关闭屏障（`closing`/`closed`/`shuttingDown`），`destroy()` 作为队列终止操作，`plugin.install()` 返回后若应用已进入销毁则回滚；`SerialIonTokenScope` 的无 token 分支纳入同一串行队列；插件 owner 通过 `PluginScope.registerCommand/Tool/Capability` 显式绑定，不再依赖跨 `await` 的全局活动 owner。
- 资源与数据语义：`ResourceRegistry.clear()` 单项失败不再中断，`finally` 清空并聚合错误；`DataCatalog` 采用不可变快照模型且 `registerAsset()` 事务化；`AnalysisTaskRegistry` 存储与返回独立副本，输入/参数与进度回调均隔离。
- 插件资源回收：新增 `PluginScope.manage(resource)` 统一托管插件创建的图形、图层、效果、任务等资源，卸载与安装回滚时自动幂次销毁。
- 发布合同：`scripts/release-gate.mjs` 升级为签名级公共 API 基线，覆盖根入口与 `./engine-cesium` 子路径；`@microsoft/api-extractor` 固定为直接 devDependency。
- 门禁分层：`npm run gate:fast` 与 `npm run gate:release` 取代单一 `gate`（`gate` 为快速层别名）。
- `bundle-baseline.json` 随功能增长更新为 `arc3dlab.esm.js` raw 240063 / gzip 61893。
- 新增测试 `tests/unit/{plugin-shutdown,plugin-owner-isolation,plugin-managed-resources}.test.ts`；`npm run gate:release` 与 `npm run test:e2e` 全绿。

## 2026-10-11（能力迁移 P6：文档与门禁）

- 开发指南新增「迁移能力」分组 5 章：军事标绘、动态图形与特效、空间分析增强、多屏联动与网格出图、导航组件与外部服务；`guide/.vitepress/config.mts` 同步侧边栏，`npm run guide:build` 通过。
- 修复构建阻塞：`vite-plugin-dts` 的 `rollupTypes`（api-extractor 7.59.4 + TypeScript 5.9.3）在解析导出类内「解构 `Map` 的 `for...of`」时触发内部缺陷（`Unable to determine semantic information for declaration`）。将 `core/capabilities`、`core/commands`、`sdk/plugins`、`effects` 四处循环改写为 `Array.from(...keys())` + `get()`，`npm run build` 恢复通过。
- 更新 `bundle-baseline.json`：`dist/arc3dlab.esm.js` raw 229446 / gzip 58727，`dist/engine-cesium.js` raw 611 / gzip 341。
- 同步 `CHANGES.md`、`LOG.md`。

## 2026-10-11（能力迁移 P5：组件与数据）

- 迁移 spec：`.monkeycode/specs/2026-10-11-larkexplorer-capability-migration/`（tasklist P5）。
- data 扩展：新增 `packages/data/src/web/{types,provider,index}.ts`，提供 `WebServiceProvider` 接口与 `createGaodeProvider({ key, fetch?, endpoint? })` 参考实现；新增 `WebServiceManager` 并挂到 `DataManager.web`。坐标以 WGS84 出入，内部用 `@arc3dlab/core` 的 `wgs84ToGcj02` / `gcj02ToWgs84` 互转；未注入提供者抛 `PROVIDER_UNAVAILABLE`，缺凭据抛 `MISSING_CREDENTIALS`。新增能力 `data:web`。
- core 扩展：新增 `packages/core/src/active-style.ts`，以纯函数（三角波）描述 `blink` / `scaling` / `jump` 三类高亮动画，`ActiveStyle` 经 `ActiveStyleWriter` 抽象端口写入并在关闭时还原基准；新增能力 `highlight:active`。
- ui 扩展：新增 `packages/ui/src/navigation-bar.ts`，`NavigationBar` 提供 `mount` / `destroy`，控件覆盖放大、缩小、复位、俯视与二三维切换；`document` 可注入以便测试。新增能力 `ui:navigation`。
- engine-cesium 扩展：新增 `getNativeSceneModeName` / `morphNativeScene` 作为场景投影模式的 Cesium 边界封装，`SceneController` 改为复用，`ui` 借此避免直接引入 `cesium`（依赖边界约束）。
- 设计变更：按用户要求**移除**行政区划数据需求（原 Requirement 23.1 与 T5-3），不提供内置省市区数据；GCJ-02/WGS84 转换沿用 `packages/core/src/datum.ts`。
- 测试新增 `tests/unit/{core-active-style,data-web-provider,ui-navigation-bar}.test.ts`（25 例）；`npm run gate` 全绿。

## 2026-10-11（开发指南站）

- 新增面向使用者的 **开发指南站**，基于 VitePress（`vitepress@^1.6.4` 开发依赖），源码位于 `guide/`，与 API 参考、Sandcastle 互补。
- 内容按类别分组共 43 个章节：简介（3）、运行时（4）、相机（2）、场景（3）、影像地形（3）、图层与数据（4）、图形（5）、交互（3）、空间分析（7）、特效与 UI（2）、迁移能力（5）、插件（1）、迁移（1）；正文中文、代码示例英文标识符。
- 站内结构：`guide/.vitepress/config.mts`（标题、nav、按类别分组 sidebar、页内目录、中文界面文案、`vite.server.allowedHosts` 含 `.monkeycode-ai.online`），`guide/.vitepress/theme/`（继承默认主题 + `PeerLinks.vue`）。
- 顶栏互链：`PeerLinks.vue` 在客户端按当前 host 计算兄弟端口——本机用 `localhost:5173/5174`，在线预览按 `<port>-<suffix>.monkeycode-ai.online` 改写，指向 Sandcastle 与 API 文档。
- `package.json` 新增 `guide:dev` / `guide:build` / `guide:preview`（独立端口 5175）；`.gitignore` 忽略 `guide/.vitepress/dist` 与 `guide/.vitepress/cache`；`.prettierignore` 同步忽略。
- CI 新增 `guide` job：`npm ci` → `guide:build` → 上传 `guide-dist` 构件。
- 文档同步：`README.md`（文档体系）、`11-api.md`（开发指南站）、本文件、`CHANGES.md`；spec 见 `.monkeycode/specs/2026-10-11-developer-guide/`。

## 2026-10-10（Cesium 风格 API 文档站）

- 新增自研 API 文档生成器 `scripts/api-docs/**`：`typedoc --json` 提取模型 → `normalize` 归一化为与渲染无关的 DocsModel → `render` 输出 Cesium/JSDoc-default 结构类名的静态站点，替换原 TypeDoc + Material 主题。
- 覆盖全部 13 个包：`typedoc.json` 改为 13 包入口 + 顶层入口的 `entryPointStrategy: resolve`；产物 `api-docs/api/`（index + 12 包命名空间页 + 符号页）。
- 页面命名默认符号名，跨包同名追加包前缀（`<pkg>.<Name>.html`）；类型无法解析时退化为纯文本，不生成链接；源码链接指向仓库对应提交的 `#L<line>`。
- `package.json` 新增 `docs:extract` / `docs:build` / `docs:preview` / `lint:docs`，`gate` 插入 `lint:docs`，移除 `typedoc-material-theme` / `typedoc-plugin-markdown`；`.gitignore` 忽略 `docs/api/`。
- 全量补齐 13 个包公共导出的中文 TSDoc（类/接口/类型别名/函数/变量及其公共成员），覆盖率门禁 summary 100%、params 100%。
- 新增单测 `tests/unit/docs-{normalize,render,type,coverage}.test.ts` 与夹具 `tests/fixtures/typedoc-model.ts`；修复归一化对「函数/方法 TSDoc 挂在签名上」的读取。
- CI 新增 `docs` job 构建并上传 `api-docs` artifact，`gate` 加入 `docs:build` + `lint:docs`；`format`/`format:check` 纳入 `scripts/api-docs/**`。

## 2026-10-10（浏览器 E2E 与质量门禁收尾）

- P1-08：新增 Playwright + Chromium（SwiftShader 无头 WebGL）浏览器 E2E；`e2e/app.spec.ts` 覆盖创建 → 添加 Graphic → 拾取 → 测量分析 → 销毁 → 重建完整路径。
- 新增 `e2e/vite.config.ts`（port 4310 strictPort、cesium 插件、alias）、`e2e/index.html`、`e2e/main.ts`（`Arc3D.create` 后写 `window.__ARC3D_REPORT__` / `__ARC3D_ERROR__`）、`playwright.config.ts`。
- `package.json` 增加 `test:e2e`；`format` / `format:check` 纳入 `e2e/**/*.ts` 与 `playwright.config.ts`；`.gitignore` 忽略 `playwright-report` / `test-results`。
- CI 新增独立 `e2e` job（`npm ci` → `playwright install --with-deps chromium` → `test:e2e`，失败上传 `playwright-report`）。
- P2-08 收尾为 DONE；文档同步 `12-engineering`（测试与 CI 门禁）、清单 P1-08 / P2-08 详情。

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
