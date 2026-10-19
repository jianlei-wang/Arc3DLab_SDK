# 工程化

Updated: 2026-10-19

## 构建

Vite library mode + TypeScript + `vite-plugin-dts`。主产物为 ESM。UMD 降为可选 legacy bundle。

库构建 `base: "./"`，静态资源以 `new URL(..., import.meta.url)` 生成模块相对 URL，兼容直接 ESM 引用与消费端打包。

`npm run build` 为 `vite build && node scripts/rollup-dts.mjs`（逐文件声明 → api-extractor 打包为 `dist/index.d.ts` / `dist/engine-cesium.d.ts`）。`npm run build:watch` 通过内联 Vite 插件在每个 watch 重建完成后自动重跑同一 declaration rollup，保证开发期 `.d.ts` 与 JS 产物一致。

## 体积与静态资源

- `bundle-baseline.json` 记录 `dist/arc3dlab.esm.js` 与 `dist/engine-cesium.js` 的 raw / gzip 基线；`npm run lint:size`（CI 在 `build` 后执行）超出基线 5% 时失败。
- 默认底图 `globe.jpg` 以 `?url&no-inline` 单独产出到 `dist/`，仅在创建默认底图时按需加载，不再内联进 JS chunk；`lint:size` 校验必需资源存在且禁止在大 JS 中内联超过阈值（`inlineImageLimitBytes`）的 base64 图片。
- `npm run lint:audit`（`npm audit --omit=dev --audit-level=high`）扫描运行时依赖漏洞。

## 包版本

- 当前发布：单一包 `arc3dlab`
- 内部包：`@arc3dlab/core` 等，`private: true`
- Cesium peer：`1.146.0`
- Active 矩阵：Arc3DLab 2.0.x + Cesium 1.146.0

## 许可证

源码 `LICENSE` 为 GNU GPL v2。`package.json` 与 README 必须与 `LICENSE` 文件一致，使用 `GPL-2.0-only`。

CesiumJS 采用 Apache-2.0，第三方底图、示例数据需要在 `NOTICE.md` 声明。

## 分发策略

| 分发形态             | 许可证影响                           | 结论           |
| -------------------- | ------------------------------------ | -------------- |
| 开源项目集成         | 与 GPL-2.0-only 兼容                 | 直接使用       |
| 闭源商业产品静态链接 | 触发 GPL 传染，需整体 GPL 或商业授权 | 需评估商业授权 |
| 独立部署的 Web 服务  | 未分发二进制，GPL 义务边界较窄       | 合规审查后使用 |
| 二次分发 / SaaS 转售 | 受 GPL-2.0-only 约束                 | 需商业授权     |

- 发布产物只包含 `dist/`（排除声明中间目录与 `*.map`）、`LICENSE`、`NOTICE.md`、`README.md`、`CHANGES.md`、`LOG.md`，见 `package.json` 的 `files`。
- `npm run gate` 的 `lint:license` 校验 `package.json` 与 `LICENSE` / `NOTICE.md` 一致。
- 商业闭源或二次分发场景需另行获取授权；在完成授权方案前，对外默认按 GPL-2.0-only 分发。

## 测试

- Unit：core 的 EventBus / Lifecycle / Registry / ID
- Integration：Arc3DApp destroy 回收
- 覆盖率：`npm run test:coverage`（v8）。全仓最低阈值 lines/statements 60、functions 58、branches 75；`core`、`engine-cesium`、`analysis` 等核心包在 `vitest.config.ts` 中另有不低于当前基线的按包阈值，CI 以 `test:coverage` 替代 `test`
- E2E：`npm run test:e2e`（Playwright + Chromium，SwiftShader 无头 WebGL）；`npm run test:e2e:firefox` 覆盖 Firefox，需在 `xvfb-run -a` 下以有头模式运行（无头 Firefox 不提供 WebGL2）。`e2e/app.spec.ts` 覆盖主链路（创建 → 添加 Graphic → 拾取 → 测量分析 → 销毁 → 重建）与失败路径（初始化失败、清理失败、多实例并行、长任务取消、外部服务成功/失败模拟、Worker 禁用/创建失败降级、重复创建销毁基线）；`e2e/perf.spec.ts` 在 `PERF=1` 时采集真实浏览器下的创建、增删、帧时间与资源回收指标
- 发布消费：`npm run test:pack` 在干净临时目录安装 tarball，覆盖 ESM / NodeNext 类型解析、CJS 拒绝、缺失与不兼容 Cesium peer、Worker 执行与发布文件清单；`npm run test:consumer` 将 tarball 安装到 `tests/fixtures/vite-consumer` 的最小 Vite 项目，执行 production build，并在 Chromium 中断言默认 Worker 资产加载、消息往返与 `createWorker` 返回空时的进程内降级

## 性能证据分层

不同层回答不同问题，避免把单一指标当通用结论：

- `bench:check`（`scripts/benchmark.mjs` + `scripts/analysis-benchmark.ts`）：前者为纯 JS 微基准，锁定核心数据结构的相对回归；后者经 `vite-node` 运行真实土方网格，记录小/中/大采样规模的耗时、采样数、RSS/堆峰值、相对解析面积误差，并覆盖进程内降级执行。Node 环境不提供浏览器 Worker，真实 Worker 与降级双模式由浏览器 E2E 覆盖；两者均不计入真实渲染性能结论。
- `bundle` 体积门禁（`lint:size` + `bundle-baseline.json`）：锁定分发体积，超基线 5% 失败。
- 真实浏览器场景（`e2e/perf.spec.ts`）：在 Chromium + SwiftShader 下测量真实 SDK 生命周期与帧节奏，产出 `frameCount` / `p50` / `p95` 帧时间与销毁后资源回收数。

真实浏览器场景仅做结构性断言（资源回收必须归零），时间数值作为趋势数据归档，不作为 PR 阻断条件。趋势采集由 `.github/workflows/perf.yml`（每日定时 + `workflow_dispatch`）执行，产物上传 `perf-report` 构件。

## CI 门禁

`.github/workflows/quality.yml` 是可复用工作流（`workflow_call`），开发分支、发布分支和发布 tag 共用同一 Node 22、action v7 与 `gate:release`：

- `gate`：`npm ci` → `gate:release`（类型检查、覆盖率、依赖/导出/稳定性/许可/API、审计、文档、指南、格式、构建、体积、基准、发布元数据、打包冒烟），并上传 `api-docs` / `guide-dist`
- `e2e`：Chromium 跑 `test:e2e`、`test:consumer`，Firefox 跑 `xvfb-run -a test:e2e:firefox`，失败时上传 `playwright-report`
- `compat`：Linux / Windows / macOS 三平台矩阵运行 `build` + `test:pack`，覆盖 Worker 线程、tarball 安装、路径大小写、junction/symlink 与文件系统差异
- `sandcastle`：在 `demo-vue3` 安装依赖并构建，上传 `sandcastle-dist`

`.github/workflows/ci.yml` 只保留 `push` / `pull_request` 触发器与 `quality` 复用入口；`.github/workflows/release.yml` 在 `v*` tag 或手动指定 tag 时先复用 `quality`，校验 tag 指向 HEAD，再由 `package` job 运行 `release:preflight`、构建并打包 tarball，归档 `SHA256SUMS`。`.github/workflows/release-verify.yml` 通过手动触发在发布后从 registry 下载 tarball，核对 integrity、发布清单与安装导入路径。四类归档（tarball、API 文档、开发指南、Sandcastle）都来自同一次运行、同一个 ref。工作流不自动执行 `npm publish`。

`master` 与 `jianlei_wang` 的差异处理：

| 项目        | `master`                                 | `jianlei_wang`                  | 决策                       |
| ----------- | ---------------------------------------- | ------------------------------- | -------------------------- |
| 触发器      | `push` / `pull_request`                  | 相同                            | 保留                       |
| Node        | 22                                       | 22                              | 保留                       |
| Action 版本 | checkout/setup-node/upload-artifact `v4` | `v7`                            | 合并到 `v7`                |
| 质量门禁    | 无 `bench:check` / `release:check`       | 两者均包含                      | 合并                       |
| 文档与指南  | 独立 `docs` / `guide` job                | 由 `gate` 构建并上传            | 删除独立 job，保留构件上传 |
| Sandcastle  | 无                                       | 独立 `sandcastle` job           | 合并                       |
| 浏览器 E2E  | 仅 Chromium                              | Chromium + Firefox（Xvfb 有头） | 合并                       |
| 发布验证    | 无                                       | `release.yml` + `perf.yml`      | 合并                       |
| `perf.yml`  | 无                                       | 定时 + 手动性能趋势             | 保留                       |

另有 `.github/workflows/perf.yml`（定时 + 手动触发，非必需检查）在 Chromium 下运行 `PERF=1 npm run test:e2e -- e2e/perf.spec.ts` 采集真实浏览器性能趋势。

本地分层门禁：`npm run gate:fast`（类型检查 + 单测 + 依赖/导出/稳定性/API 审查/许可/API 边界 + 格式）；`npm run gate:release`（快速层改用 `test:coverage`，叠加 `lint:audit`、`docs:build`、`lint:docs`、`guide:build`、`build`、`lint:size`、`bench:check`、`release:check`、`test:pack`）；`npm run gate` 是 `gate:fast` 的别名。浏览器 E2E 始终单独运行。

推送前强制检查：仓库跟踪 `.githooks/pre-push`，在每次 `git push` 前运行 `npm run gate:release`，失败即中止推送。`package.json` 的 `prepare` 脚本在安装依赖时执行 `git config core.hooksPath .githooks` 自动启用该钩子；`.githooks/prepare-commit-msg` 负责 co-author 注入。紧急情况下可设置 `SKIP_PREPUSH_CHECK=1` 跳过（CI 仍会执行同样检查）。

## 责任归属与分支保护

- `.github/CODEOWNERS` 按域划分评审人：公共 API / 生命周期 / 渲染（Cesium）/ GIS 算法 / CI 与发布。
- `.github/PULL_REQUEST_TEMPLATE.md` 将下列检查固化为合并前置项：公共 API / SemVer 影响声明、生命周期与资源契约（失败聚合、快照读取、异步回滚）、`gate:release`（推送前钩子强制）与按需 E2E。
- 目标分支启用必需状态检查：`quality / gate`（包含 typecheck、单元测试、构建与打包冒烟）。`quality / e2e` 与 `quality / sandcastle` 同时运行，可按团队稳定性要求追加为必需检查。
- 保护规则同时禁止直接推送、强推与删除分支，并要求通过 PR 合并；个人项目默认 0 名审批人但强制 PR，团队配置至少 1 名审批人。
- 应用入口为 `scripts/configure-repo-governance.sh`（使用具备 `admin` 权限的 `gh` 登录）。截至 2026-10-19，当前执行环境的 GitHub App 安装令牌 `permissions.admin=false`，读取分支保护 API 返回 `403 Resource not accessible by integration`，规则尚未实际写入，需仓库管理员执行该脚本或在 GitHub UI 配置。
- 分支保护与必需检查属于 GitHub 仓库设置；仓库内的 `CODEOWNERS`、复用工作流与默认分支约定为唯一事实来源。

## 公共 API 与 SemVer 治理

- `scripts/public-api-manifest.json` 记录根入口与 `./engine-cesium` 子路径的 `values` / `types` / `signatures` / `deprecated`；`lint:exports`（`release-gate.mjs exports`）在 CI 中比对签名与弃用元数据，漂移即失败。manifest 的 `entries` 必须与 `package.json` 的 `exports` 子路径一一对应，顶层 `values` / `types` 必须与 `entries["."]` 一致。
- `scripts/public-api-stability.json` 是稳定性分级事实源，要求每个公开导出恰好属于 `stable` / `experimental` / `internal` / `deprecated` 之一；`lint:stability` 校验覆盖、重复、弃用元数据与 manifest 注记一致性。
- `npm run api:review` 相对 `scripts/api-history/` 最近快照评估变更：移除或修改稳定导出需要 major，实验性不兼容变更进入 minor，internal 允许 patch；弃用项在 `removeIn` 之前移除会被拒绝。被移除或修改的导出按**已发布快照**的分级判定，新增导出按当前策略判定。
- API 变更流程：改代码 → `node scripts/release-gate.mjs exports:update` 刷新基线 → 运行 `api:review` → 人工审查 diff → 在 PR 模板中声明稳定性等级、变更内容与 SemVer 判定 → 破坏性变更写入 `CHANGES.md` 的 `Breaking Changes`，弃用项写入 `### Deprecated`。
- `exports:update` 只负责刷新基线，不构成对破坏性改动的接受；签名 diff 仍需 CODEOWNERS 审阅。刷新公共 API 后运行 `npm run api:snapshot` 更新 `scripts/api-history/v<version>.json`，快照内嵌当次稳定性策略。
- `gate:release` 包含 `release:check`：校验 `package.json` / `package-lock.json` 版本、`CHANGES.md` 已发布小节、日期与 `Known Limitations`、版本位与变更类型一致（breaking → major，feat → minor+）、`COMPATIBILITY.md` 活跃矩阵、迁移说明，以及 tag 对应 API 快照是否存在且同步。
- `release:preflight` 在 tag 提交上检查工作区干净、tag 指向 HEAD、快照存在与发布元数据一致；`release:verify` 在发布后核对 registry 元数据、tarball integrity、发布清单与安装导入路径。
- 高级 / 不稳定入口（如 `app.native.viewer`）不纳入 SemVer 保证，见 `11-api`、`COMPATIBILITY.md` 与 `docs/guides/release-checklist.md`。

开发命令、即时测试、预览、API 文档生成和 npm 发布步骤见 `docs/guides/sdk-development.md`。
