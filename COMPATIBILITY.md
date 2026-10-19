# 兼容性与版本策略

Updated: 2026-10-19

## 模块格式

`arc3dlab` 与 `arc3dlab/engine-cesium` 均为 **ESM-only**：

- 通过 `import` 加载，`exports` 仅声明 `types` 与 `import`，不提供 `require` 出口。
- 构建目标为现代打包器（Vite 5+ / Rollup 4+ / webpack 5 ESM）与 Node `>=22` ESM。
- 浏览器最低要求：支持 `structuredClone` 与 ES module Worker 的现代浏览器（Chrome / Edge 98+、Firefox 94+、Safari 15.4+），并具备 Cesium 所需的 WebGL2。
- Worker 由 SDK 构建产物中的独立 ES module 资源提供，消费端打包器需支持 `new Worker(new URL(...), { type: "module" })`；Vite 用户无需额外配置，若项目覆盖 `worker.format`，应保持 `"es"`。
- 运行环境没有 `Worker` 或 Worker 构造失败时，`AnalysisJobHost` 自动降级为进程内执行，并通过 `getDiagnostics().workerUnavailable` 与 `createdWorkers` 暴露实际路径；需要强制验证 Worker 路径时应检查这些诊断字段。
- 降级限制：进程内执行与主线程共享事件循环，只有 `cutfill-grid` 等分块作业能在块间响应取消；其他同步作业只能在开始与结束时观察取消，长时间计算期间可能阻塞渲染。对交互延迟敏感的生产路径应确保 ES module Worker 可用。
- Node 20 及以下不受支持；缺少 `structuredClone` 的旧浏览器会在作业入队前以 `UNSUPPORTED_CAPABILITY` 明确拒绝。
- `AnalysisJobHost` 在入队前用 `structuredClone` 生成独立快照；运行时缺少该 API 时以 `UNSUPPORTED_CAPABILITY` 明确拒绝，缺口不降级为共享引用。
- 不支持 CommonJS `require("arc3dlab")`；如需在 CJS 环境使用，请通过动态 `import()`。
- 发布合同由 `scripts/pack-smoke.mjs` 覆盖运行时导入、缺失 Cesium、CJS 拒绝、NodeNext 类型解析与 peer 版本冲突；`npm run test:consumer` 再用 tarball 安装到真实 Vite 消费者，执行生产构建并在 Chromium 中验证 Worker 与降级路径。
- 安装时请同时提供精确匹配的 `cesium@1.146.0`：`npm i arc3dlab cesium`。缺失 Cesium 时导入会以 `ERR_MODULE_NOT_FOUND` 明确失败；安装不兼容版本会被 npm 的 peer 解析以 `ERESOLVE` 拒绝。
- `npm run lint:exports` 持续治理 ESM-only 与依赖锁定：`type` 必须为 `module`，`main` 与 `exports.*.require` 不得出现，`peerDependencies.cesium` 与 `devDependencies.cesium` 必须同时精确等于 `1.146.0`，Node 引擎下限为 `>=22`。

## 发布产物策略

`package.json` 的 `files` 以 `dist` 整树为发布来源，并排除声明中间目录与 source map：

```json
"files": [
  "dist",
  "!dist/src",
  "!dist/packages",
  "!dist/**/*.map",
  "README.md",
  "CHANGES.md",
  "LOG.md",
  "NOTICE.md",
  "LICENSE"
]
```

- `dist` 发布入口 JS、最终 `.d.ts`、`dist/assets/**` 中的 Worker、静态图片，以及未来新增的顶层或嵌套 chunk。
- `dist/**/*.map` 只在本地构建目录保留，不进入 tarball；发布包不包含测试、源码、内部脚本或临时文件。
- `dist/src` 与 `dist/packages` 只包含 `vite-plugin-dts` 的中间声明，不进入 tarball；消费者使用的是 `dist/index.d.ts` 与 `dist/engine-cesium.d.ts`。
- `scripts/publish-manifest.mjs` 从构建产物生成期望清单并排除 source map；`npm run test:pack` 逐项断言清单文件、`exports` / `module` / `types` 入口都进入 tarball 并完成解压安装，同时拒绝多打包的 `dist` 文件、source map 与私有 `node_modules`。

## 渲染引擎定位

采用 **Cesium-first**：`core` 不依赖 Cesium，业务包可直接依赖 `cesium`；`Engine` 为内部生命周期/能力接缝，多渲染后端为长期路线图，不构成当前 API 合同（详见 `docs/architecture/03-engine.md`）。

## 兼容矩阵

| Arc3DLab | Cesium  | Node | 状态                         |
| -------- | ------- | ---- | ---------------------------- |
| 2.0.x    | 1.146.0 | >=22 | Active                       |
| 1.0.x    | 1.146.0 | >=22 | Legacy（旧版兼容入口仍可用） |
| 0.x      | 1.136.0 | >=20 | Legacy                       |

peerDependencies 精确锁定为 `cesium@1.146.0`。

## 旧版内容移除（1.x → 2.0）

2.0.0 移除了以下旧版兼容资产，属于 SemVer Major 破坏性变更：

| 已移除符号                                                    | 归属                           | 迁移路径                                                                        |
| ------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `Viewer` / `Map` / `LegacyViewerOptions` / `LegacyMapOptions` | 根入口与 `@arc3dlab/legacy` 包 | `Arc3D.create()` / `Arc3D.createSync()`，见 `docs/architecture/13-migration.md` |
| `Arc3DPlugin.dependsOn`                                       | `@arc3dlab/sdk`                | 能力依赖使用 `requiresCapabilities`，插件依赖使用 `dependsOnPlugins`            |
| `AnalysisWorkerHost`                                          | `@arc3dlab/analysis`           | 使用 `AnalysisJobHost`                                                          |

迁移窗口：1.x 期间旧版符号保持可用；自 2.0.0 起仅保留当前契约符号，消费者需在升级前完成迁移。

## 依赖锁定策略

- **精确锁定**：`cesium` 通过 `peerDependencies` 精确锁定，避免 core 私有 API 漂移导致的运行时差异。
- **支持范围**：`@arc3dlab/*` 内部包随主包一起发布，不单独发版，消费者不感知内部版本。
- **构建期**：`vite` / `typescript` / `vitest` 采用 `^` 范围，仅影响开发与构建，不进入运行时合同。

### Cesium 内部 API 依赖（升级高风险点）

SDK 直接依赖以下 Cesium 内部实现入口，它们带下划线、不属于 Cesium 公开 API，也不属于 Arc3DLab 的稳定公开合同，**不得被无限期依赖**。升级 `cesium` 时必须逐项核查。

| 内部 API                                              | 使用位置                                                                                                      | 用途               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------ |
| `Material._materialCache.addMaterial` / `getMaterial` | `packages/effects/src/materials.ts`（动态扩散、线尾迹）、`packages/graphics/src/dynamic/materials.ts`（雷达） | 注册自定义材质类型 |

- **原因**：Cesium 1.146.0 未提供公开的材质注册 API，`Material.fromType` 自身也消费同一内部缓存。
- **缓解措施**：
  - `cesium` 在 `peerDependencies` 中精确锁定为 `1.146.0`，降低近期不兼容概率。
  - 注册入口以 `if (!cache) return` 守卫访问，结构缺失时静默跳过而非抛错。
  - `tests/integration/cesium-material-registration.test.ts` 针对锁定版本做版本契约集成测试：探针缓存结构、校验三类材质进入缓存、复用 Cesium 真实编译路径（`Material.fromType`），并断言运行时 `Cesium.VERSION` 与 `package.json` 的 peer 版本一致。
  - 浏览器 E2E 在真实渲染路径创建雷达扫描与扩散点图形，覆盖自定义材质在 Chromium 中的实际编译与绘制。
  - 升级流程：更新 `peerDependencies.cesium` / `devDependencies.cesium` 与本文件兼容矩阵 → `npm run lint:exports` → `npm run test:integration` → `npm run build && npm run test:pack` → `npm run test:e2e`。任一步失败都先更新访问层与测试，再重新锁定版本。
  - CI 治理：`gate` 任务运行类型检查、全量测试（含材质注册集成用例）、构建、体积与打包 smoke；独立的 `e2e` 任务运行浏览器回归。

## SemVer 承诺范围

| 变更类型                      | 版本位 | 示例                                                     |
| ----------------------------- | ------ | -------------------------------------------------------- |
| 稳定 API 破坏性变更           | Major  | 移除或改名稳定导出、改变稳定 Manager 方法签名            |
| 稳定 API 向后兼容新增         | Minor  | 新增 Manager 方法、新增可选配置字段、新增稳定语义类型    |
| 实验性 API 不兼容变更         | Minor  | 调整 Worker 传输类型、改名 `arc3dlab/engine-cesium` 导出 |
| 修复、内部实现与内部 API 调整 | Patch  | 缺陷修复、性能优化、内部类型重构、internal 导出调整      |

稳定性分级以 `scripts/public-api-stability.json` 为准：

- `stable`：根入口的高层运行时、类型合同与纯计算 API，纳入 SemVer 保证。
- `experimental`：根入口的 Worker 作业传输层，以及 `arc3dlab/engine-cesium` 子路径全部导出；允许在 minor 调整，必须在 `CHANGES.md` 记录，patch 不得破坏。
- `internal`：`NativeContext` 与标绘动画内部函数；可以随 patch 调整，消费者不应依赖。
- `deprecated`：进入弃用周期的稳定或实验性 API。

纳入 SemVer 保证的公共合同还包括 `Arc3DApp` 及其 Managers（`graphics` / `layers` / `data` / `scene` / `interaction` / `analysis` / `effects` / `ui` / `terrain`）的方法签名与 `packages/core` 语义类型。

不纳入 SemVer 保证：`app.native.viewer` 及 `native` / `scene` / `camera` / `canvas` 逃生舱、`@arc3dlab/*/src/*` 内部模块、`tests/fixtures` 与 `examples`。

## 弃用周期

1. 计划删除或变更的公共 API 先加 `@deprecated` JSDoc，并在 `scripts/public-api-stability.json` 的 `deprecated` 或 `deprecatedMembers` 中登记 `since`、`removeIn`、`replacement` 与 `reason`。
2. 同版本 `CHANGES.md` 必须包含 `### Deprecated`，说明替代项和迁移示例。
3. 最短保留一个 minor；`removeIn` 必须晚于 `since` 的 major，只能在下一个 major 或更晚移除。例如 `since: 2.1.0` 的 API 最早可在 `3.0.0` 移除。
4. 移除前运行 `npm run api:review`，确认版本已到达 `removeIn` 且属于 major 变更；`release:check` 会拒绝未满足周期的发布。
5. 重大用户路径的变更必须在 `docs/architecture/13-migration.md`、`docs/guides/migration.md` 或 `guide/migration/` 提供迁移示例。

未登记弃用元数据的移除、提前移除或缺少迁移说明都会被门禁拦截。

## 版本与日志规则

- 采用 SemVer：`major.minor.patch`；预发布使用 `-alpha.N` / `-beta.N`。
- `CHANGES.md` 当前及后续正式版本必须包含日期、变更分类与 `### Known Limitations`；破坏性变更使用 `### Breaking Changes`，新功能使用 `### feat`，修复使用 `### fix`，弃用使用 `### Deprecated`。
- `release:check` 根据上一已发布版本校验版本位：破坏性变更必须 major，`feat` 必须 minor 或 major；breaking 出现在 minor、feature 出现在 patch 都会被拒绝。
- `package.json`、`package-lock.json`、Git tag 与 `CHANGES.md` 版本必须一致；tag 发布时 `Unreleased` 必须清空。
- 当前版本公共 API 快照保存在 `scripts/api-history/v<version>.json`；发布 tag 时快照必须存在且与 `scripts/public-api-manifest.json` 一致。

## 变更管理流程

1. 公共 API 变更先更新 `docs/architecture/11-api.md`、`scripts/public-api-stability.json` 与 `CHANGES.md`。
2. 破坏性变更必须补充 `docs/architecture/13-migration.md` 或 `guide/migration/` 迁移指引。
3. `npm run lint:exports` 校验发布入口、`exports` 字段与 manifest 子路径一致性；`npm run lint:stability` 校验稳定性分级覆盖与弃用元数据；`npm run api:review` 按版本位评估导出和签名变更；`lint:api` 阻止消费者深路径导入。
4. 公共导出或签名变化后运行 `node scripts/release-gate.mjs exports:update` 刷新 manifest，人工审查 diff，再按需运行 `npm run api:snapshot` 更新当前版本快照。
5. 合并进发布分支后更新版本号、`CHANGES.md` 与活跃兼容矩阵，并运行 `npm run release:preflight -- --tag v<version>`。
6. `npm run test:pack` 实际安装 tarball，校验许可证、声明文件、Worker、ESM-only 出口与 `cesium` peer 依赖合同；发布后运行 `npm run release:verify -- --version <version>` 核对 registry tarball、完整性与安装导入路径。
