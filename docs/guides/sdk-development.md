# Arc3DLab SDK 开发说明

本文是 SDK 日常迭代手册，覆盖仓库结构、即时测试、预览、API 文档和发布。架构原则与模块边界以 `docs/architecture/` 为准。

## 文档地图

| 文档                             | 用途                                               |
| -------------------------------- | -------------------------------------------------- |
| `docs/guides/sdk-development.md` | 本文件：开发、测试、预览、发布                     |
| `docs/architecture/`             | 可迭代设计：模块边界、API 契约、路线图             |
| `docs/architecture/11-api.md`    | 稳定公共 API                                       |
| `docs/guides/migration.md`       | 从 `Viewer` 迁到 `Arc3D.create()`                  |
| `README.md`                      | 安装与最小用法                                     |
| `CONTRIBUTING.md`                | 贡献原则                                           |
| `guide/`（VitePress）            | 面向使用者的开发指南，本地预览 `npm run guide:dev` |
| 自研生成器 `api-docs/`           | 由源码生成的 API 参考                              |

## SDK 概览

Arc3DLab 是面向三维 WebGIS 的模块化场景运行时。CesiumJS 是首个渲染引擎。

当前策略：内部用 `packages/*` 分模块，对外仍发布单一 npm 包 `arc3dlab`。

当前版本：`2.0.0`。Cesium peer 固定为 `1.146.0`。兼容矩阵见 `COMPATIBILITY.md`。

### 仓库结构

```text
packages/
  core/            Runtime：Context / EventBus / Lifecycle / Registry
  engine-cesium/   Cesium 适配器与引擎接缝
  scene/           相机、渲染、视口、时钟、环境
  layers/          底图、地形、图层、3D Tiles
  graphics/        点线面等 Graphic
  data/            数据描述与 Provider
  interaction/     拾取、选择、指针
  analysis/        测量与空间分析
  effects/         特效
  plotting/        标绘符号与纯几何算法
  ui/              Tooltip 等 UI
  sdk/             Arc3D.create / Arc3DApp
src/index.ts       对外再导出
tests/unit/        Vitest 单元测试
demo-vue3/         即时预览（alias 指向源码）
guide/             开发指南（VitePress，源码）
docs/architecture/ 设计文档
docs/guides/       开发与迁移指南
```

`packages/*` 均为 `private: true` 的内部包。npm 发布物只有根包 `arc3dlab`，产物在 `dist/`。

依赖方向：

```text
core
  ^
engine-cesium
  ^
scene / layers / data / graphics
  ^
interaction / analysis / effects / plotting / ui
  ^
sdk
```

`core` 只依赖 TypeScript 标准库，不依赖 Cesium。其余业务包采用 **Cesium-first**，可直接依赖 `cesium`；允许直接依赖 `cesium` 的包为 `engine-cesium`、`data`、`scene`、`layers`、`graphics`、`interaction`、`analysis`、`effects`、`plotting`。该边界由 `scripts/release-gate.mjs` 的 `CESIUM_PACKAGES` 门禁固化，详见 `docs/architecture/03-engine.md`。

### 入口

稳定入口：

```ts
import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({
  container: "map",
  tokens: {
    cesiumIon: import.meta.env.VITE_CESIUM_ION_TOKEN,
  },
})
```

根入口稳定导出：`Arc3D`、`Arc3DApp`、`Graphic`、`Layer`、`LngLat`、`LngLatHeight`、`CameraPose`、`PickResult`、`Arc3DPlugin`、`Arc3DError`。

分析任务合同同时从根入口导出：`AnalysisJobHost`、`executeAnalysisJob`、`AnalysisTaskRegistry`、`createTaskExecutor`，以及 `AnalysisJob` / `AnalysisJobResult` / `AnalysisJobHostOptions` / `AnalysisWorkerFactory` / `AnalysisWorkerLike` 等类型。`app.analysis` 的纯数值方法经共享作业宿主调度，`terrain.*` / `visibility.*` 保持主线程执行。

`Viewer` / `Map` 兼容入口已在 2.0.0 移除，请使用 `Arc3D.create()`（迁移映射见 `docs/architecture/13-migration.md`）。

高级入口：

```ts
import { CesiumEngine } from "arc3dlab/engine-cesium"
```

Cesium 类型从 `cesium` 导入。

## 开发指南

### 环境

- Node.js：`package.json` 的 `engines.node` 为 `>=22`
- 浏览器：支持 `structuredClone` 与 ES module Worker 的现代浏览器（Chrome / Edge 98+、Firefox 94+、Safari 15.4+），并具备 Cesium 所需的 WebGL2
- Worker：默认在独立线程执行纯数值分析；环境缺少 `Worker` 或创建失败时自动降级到进程内，`AnalysisJobHost.getDiagnostics().workerUnavailable` 会反映实际路径。降级与主线程共享事件循环，只有分块作业能在块间取消，其他同步作业可能阻塞渲染
- 打包器：Vite 5+、Rollup 4+、webpack 5 ESM；Worker 依赖 `new Worker(new URL(...), { type: "module" })`，覆盖 `worker.format` 时需保持 `"es"`
- 包管理：根目录 `npm install`
- 许可证：`GPL-2.0-only`，与 `LICENSE` 一致

### 安装

```bash
# 安装 SDK 与 Cesium peer
npm install
```

消费方安装：

```bash
npm i arc3dlab cesium
```

### 迭代顺序

1. 先改 `docs/architecture/` 对应设计文件。
2. 在 `docs/architecture/CHANGELOG.md` 追加：日期、变更点、影响模块。
3. 公共 API 变更同步 `docs/architecture/11-api.md` 与 `docs/guides/migration.md`。
4. 原则变更同步 `docs/architecture/01-principles.md` 与 `CONTRIBUTING.md`。
5. 再改 `packages/*` 与测试。
6. 运行 `npm test` 与 `npm run build`。
7. 用 `demo-vue3` 做场景预览。

源码改动放在 `packages/*`。根目录 `src/index.ts` 只做对外再导出。

### 日常命令

```bash
# 安装依赖
npm install

# 单次单元测试
npm test

# 监听测试
npm run test:watch

# 构建 ESM 与类型声明
npm run build

# 监听构建（Vite 产物 + 逐文件声明，并在每次重建后重新打包 rollup 声明）
npm run build:watch

# 生成 API 文档
npm run docs

# 构建开发指南（VitePress）
npm run guide:build

# 构建 Sandcastle（需先在 demo-vue3 安装依赖）
npm run build:sandcastle

# 校验发布元数据（版本、日志、兼容矩阵与迁移说明）
npm run release:check -- --tag v2.0.0

# 发布包安装与类型/Worker 验证
npm run test:pack

# 真实 Vite 消费者生产构建 + 浏览器 Worker/降级验证
npm run test:consumer

# 格式化
npm run format
```

构建产物：

- `dist/arc3dlab.esm.js`：主 ESM
- `dist/index.d.ts`：主类型
- `dist/engine-cesium.js` 与 `dist/engine-cesium.d.ts`：引擎子路径
- `dist/assets/analysis-worker-entry-*.js`：分析 Worker 的 ES module 资源
- `dist/globe.jpg` 等静态资源
- `dist/**/*.map`：仅本地调试使用，不进入 npm tarball

Cesium 作为 external，不会打进 SDK bundle；消费端必须自行安装精确匹配的 `cesium@1.146.0`。

## 即时测试

改完代码后按这条链路验证：单元测试 -> 源码预览 -> 构建产物。

### 1. 单元测试

测试跑在 Node 环境（`vitest.config.ts` 的 `environment: "node"`），用例位于 `tests/unit/`，覆盖 `packages/*` 各包（`core`、`engine-cesium`、`analysis`、`effects`、`plotting` 等）与门禁脚本。

```bash
# 仓库根目录
npm test
```

新增稳定公共 API 时，把用例加到 `tests/unit/`。文件名使用 `*.test.ts`。

监听模式适合改 core 时连续跑：

```bash
npm run test:watch
```

### 2. 源码即时预览

`demo-vue3` 通过 Vite alias 直接引用仓库源码，改 `packages/*` 后保存即可热更新。

```bash
cd demo-vue3
npm install
npm run dev
```

默认开发服务器端口为 `5173`。本环境预览域名需要 `server.allowedHosts` 包含 `.monkeycode-ai.online`，`demo-vue3/vite.config.ts` 已配置。

Cesium 静态资源由 `vite-plugin-cesium` 提供。应用入口示例：

```ts
import { Arc3D, type Arc3DApp } from "arc3dlab"

const app = await Arc3D.create({ container: "cus-map" })
```

浏览器控制台可直接使用 `window.app` 试 API。

需要 Ion / 天地图时，在运行时传入 token：

```ts
const app = await Arc3D.create({
  container: "cus-map",
  tokens: {
    cesiumIon: import.meta.env.VITE_CESIUM_ION_TOKEN,
  },
})
```

源码默认配置只允许占位符，token 由调用方注入。

### 3. 构建产物验证

发布前确认打包结果可被消费：

```bash
# 仓库根目录
npm run build
npm run test:pack
npm run test:consumer
```

`test:pack` 会在干净临时目录安装 tarball，验证 ESM / NodeNext 类型解析、CJS 拒绝、缺失与不兼容 Cesium、Worker 执行和发布文件清单。`test:consumer` 进一步把 tarball 安装到最小 Vite 消费者，执行生产构建，并在 Chromium 中验证默认 Worker 的消息往返与 `createWorker` 返回空时的进程内降级。

## 预览

### 开发预览

首选 `demo-vue3`：

```bash
cd demo-vue3
npm run dev
```

访问本机 `http://localhost:5173`。在线预览环境会把该端口映射为 `*.monkeycode-ai.online`。

### API 文档预览

```bash
# 生成 API 参考站
npm run docs:build

# 在 5174 提供静态站点
npm run docs:preview
```

本机访问 `http://localhost:5174`。在线预览环境会把该端口映射为独立的 `5174-*.monkeycode-ai.online` 地址，与 Sandcastle `5173` 并存。

### 开发指南预览

```bash
# 开发模式（端口 5175，热更新）
npm run guide:dev

# 构建并预览产物（端口 5175）
npm run guide:build
npm run guide:preview
```

本机访问 `http://localhost:5175`。在线预览环境映射为独立的 `5175-*.monkeycode-ai.online` 地址；指南顶栏会自动互链到 Sandcastle（5173）与 API 文档（5174）。

### 生产构建预览

```bash
cd demo-vue3
npm run build
npm run preview
```

这条路径验证的是 demo 自己的生产构建。验证 SDK 发布物时，先在仓库根目录执行 `npm run build`。

### 静态资源

若 Cesium Workers / Assets 404，确认 Vite 已启用 `vite-plugin-cesium`：

```ts
import cesium from "vite-plugin-cesium"

export default defineConfig({
  plugins: [cesium()],
})
```

## API 文档

API 文档分三层：

1. 设计契约：`docs/architecture/11-api.md`，描述稳定入口与兼容策略。
2. 开发指南：`guide/`（VitePress），面向使用者的任务导向文档。
3. 源码参考：自研生成器从源码提取，输出到 `api-docs/api/`。

```bash
# 生成 API 参考站
npm run docs:build

# 校验公共符号注释覆盖率
npm run lint:docs

# 开发指南（VitePress）
npm run guide:dev
```

`api-docs/` 已在 `.gitignore` 中，生成结果用于本地查阅或站点发布。
本地或在线预览使用 `npm run docs:preview`，端口 `5174`。

公共 API 注释写在导出符号上。注释缺失会由 `lint:docs` 门禁拦截（summary 阈值 70%，params 阈值 50%）；当前覆盖率以 `npm run lint:docs` 输出为准（summary 100%，params 98.6%）。

应用侧迁移对照见 `docs/guides/migration.md`。

## 发布

对外发布的是根包 `arc3dlab`。`files` 以 `dist` 整树为发布来源，并排除声明中间目录：

- `dist`（含入口 JS、Worker、静态资源与嵌套 chunk；source map 不发布）
- `!dist/src`
- `!dist/packages`
- `!dist/**/*.map`
- `README.md`
- `CHANGES.md`
- `LOG.md`
- `NOTICE.md`
- `LICENSE`

`scripts/publish-manifest.mjs` 生成期望产物清单，并排除 `dist/**/*.map`。`npm run test:pack` 不只检查清单与入口，还会实际安装 tarball 并验证：

- 打包与安装目录中的 `LICENSE` / `NOTICE.md` / `README.md` / `CHANGES.md` / `LOG.md` 与仓库内容一致；
- 安装后的 `package.json` 保持 ESM-only、无 `main` / `require` 出口、无运行时 `dependencies`，且 `peerDependencies` 只有精确的 `cesium@1.146.0`；
- `exports` / `module` / `types` 指向的文件存在，TypeScript 消费者在 `bundler` 与 `nodenext` 解析模式下都能编译；
- 缺失 Cesium 时导入明确失败，CJS `require()` 被拒绝，不兼容的 Cesium 版本触发 npm peer 冲突；
- 安装包内的 Worker 资产能真实执行距离与面积作业；
- tarball 不夹带 `src/`、`packages/`、`tests/`、`scripts/`、`node_modules/` 等源码路径、source map 或私有 `node_modules`。

### 发布分支合并后

版本号与发布日志在合并进发布分支后按实际发布计划更新。完整审计表见 `docs/guides/release-checklist.md`。

1. 更新根 `package.json` 版本，并同步 `package-lock.json` 根版本。可用 `npm version <version> --no-git-tag-version`，避免提前创建 tag。
2. 把 `CHANGES.md` 的 `Unreleased` 条目整理到 `## v<version> - YYYY-MM-DD`，并清空 `Unreleased`；必须包含 `### Known Limitations`，破坏性变化保留 `### Breaking Changes`，弃用项使用 `### Deprecated`。打 tag 时仍有 `Unreleased` 条目会被门禁拒绝。
3. 破坏性变化必须同步迁移说明：`docs/architecture/13-migration.md`、`docs/guides/migration.md` 或 `guide/migration/` 至少一处覆盖该版本。
4. 同步 `COMPATIBILITY.md` 的活跃兼容矩阵（例如 `2.0.x`）。
5. 如公共 API 有变更，先运行 `node scripts/release-gate.mjs exports:update` 刷新 manifest，再运行 `npm run api:review` 按稳定性等级与版本位审查，最后运行 `npm run api:snapshot` 写入 `scripts/api-history/v<version>.json`。刷新基线不等于接受破坏性变更。
6. 运行 `npm run release:check`，确认版本、锁文件、发布日志、已知限制、兼容矩阵、迁移说明与 API 快照一致。

### 发布前检查

1. `npm run release:preflight -- --tag v<version>` 通过；该检查要求工作区干净、tag 指向 HEAD、快照存在且发布元数据一致。
2. `npm run gate:release` 通过（包含单测覆盖率、依赖/导出/稳定性/许可/API 门禁、API 文档、开发指南、构建、体积、基准、发布元数据与 `test:pack`）。
3. `npm run test:e2e` 通过；Firefox 额外运行 `xvfb-run -a npm run test:e2e:firefox`；`npm run test:consumer` 验证 tarball 在真实 Vite 生产构建与浏览器中的 Worker/降级路径。
4. 在 `demo-vue3` 安装依赖后运行 `npm run build:sandcastle`，确认 Sandcastle 与当前源码同一提交可构建。
5. `npm pack --dry-run` 检查最终文件列表，再用 `npm run test:pack` 做实际安装验证。

### 同一提交的发布产物

发布 tag 触发的 `.github/workflows/release.yml` 会从同一个 commit 依次完成：

- 发布元数据检查与 `gate:release`；
- Chromium / Firefox 浏览器回归；
- Sandcastle 构建；
- `npm pack` 生成 tarball；
- 上传 `release-tarball`、`api-docs`、`guide-dist`、`sandcastle-dist` 四类归档。

工作流只验证与归档，不自动执行 `npm publish`；npm 发布凭据与最终人工确认留在发布流程中。任何一类产物都必须来自触发发布的同一个 tag。

### 版本与日志

当前版本在根 `package.json`：`2.0.0`。

- 面向用户的版本说明：`CHANGES.md`
- 开发过程日志模板：`LOG.md`

alpha / beta 使用 SemVer 预发布号，例如 `2.1.0-alpha.1`。

### 发布命令

```bash
# 确认发布元数据一致
npm run release:check -- --tag v2.0.0

# 确认登录 npm
npm whoami

# 仓库根目录构建
npm run build

# 检查即将发布的文件列表
npm pack --dry-run

# 发布到 npmjs（registry 见 publishConfig）
npm publish --access public
```

预发布标签示例：

```bash
npm publish --tag alpha --access public
```

`publishConfig.registry` 为 `https://registry.npmjs.org/`。GPL-2.0 要求随包分发 `LICENSE` 与 `NOTICE.md`。

### 发布后

1. 给 Git 打与 `package.json` 相同的 tag，例如 `v2.0.0`。
2. 推送分支与 tag；tag 会触发发布验证工作流，归档 tarball 与 `SHA256SUMS`。
3. 运行 `npm run release:verify -- --version <version>`，从 registry 下载 tarball 并核对完整性、发布清单与安装导入路径。
4. 在消费项目中安装新版本，核对 Cesium 静态资源与主入口 `Arc3D.create()`。
5. 按 `docs/guides/release-checklist.md` 的模板记录发布提交、tag、tarball、门禁结果与回滚方案。

## 贡献约束（摘要）

完整原则见 `CONTRIBUTING.md` 与 `docs/architecture/01-principles.md`。

1. `core` 独立于 Cesium、Vue、React。
2. 公共 API 使用明确类型。
3. 模块加载无副作用。
4. Token 运行时注入。
5. SDK 创建的资源可回收。
6. 异步 API 声明 `Promise<T>`。
7. Layer 与 Graphic 分离。
8. 稳定公共 API 配备自动化测试。
