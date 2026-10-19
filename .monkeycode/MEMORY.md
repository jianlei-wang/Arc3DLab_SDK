# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[User Instruction Summary]
- Date: 2026-10-11
- Context: 迁移工作完成后，用户指示变更提交策略
- Instructions:
  - 后续所有提交都在 `jianlei_wang` 分支上进行，不要提交到 `master`。
  - 需要时先将 `master`（主分支）的更新同步到 `jianlei_wang` 分支再继续开发。

[Project Knowledge Summary]
- Date: 2026-10-11
- Context: Discovered by Agent while diagnosing a CI failure (gate/docs/guide/e2e 全部在 npm ci 阶段失败)
- Category: Build Methods
- Instructions:
  - 新增 npm 工作区包（如 `packages/plotting`）后必须同步更新 `package-lock.json`，否则 CI 的 `npm ci` 会因 package.json 与 lockfile 不同步而失败（本地因 node_modules 已存在不会暴露该问题）。
  - 更新命令：`npm install --package-lock-only --ignore-scripts`（仅改 lockfile，不动 node_modules）；校验可用 `npm ci --dry-run`。
  - 提交前可先跑 `npm run gate:release`（覆盖 `typecheck`、`test:coverage`、`lint:deps/exports/license/api/audit/docs`、`docs:build`、`guide:build`、`format:check`、`build`、`lint:size`、`test:pack`）；浏览器 E2E 仍单独运行 `npm run test:e2e`。

[Project Knowledge Summary]
- Date: 2026-10-11
- Context: Discovered by Agent while implementing the LarkExplorer capability migration (P5/P6)
- Category: Troubleshooting & Debugging
- Instructions:
  - `npm run build` 的 `vite-plugin-dts`（`rollupTypes`，api-extractor 7.59.4 + TypeScript 5.9.3）在解析「导出类内对 `Map` 的解构迭代」`for (const [k, v] of someMap)` 时会崩溃，报 `[vite:dts] Internal Error: Unable to determine semantic information for declaration`。
  - 规避写法：`for (const k of Array.from(someMap.keys())) { const v = someMap.get(k) }`。已修复 `packages/core/src/capabilities.ts`、`packages/core/src/commands.ts`、`packages/sdk/src/plugins.ts`、`packages/effects/src/index.ts`。

[Project Knowledge Summary]
- Date: 2026-10-11
- Context: Discovered by Agent while extending the browser E2E suite (P6)
- Category: Environment Configuration
- Instructions:
  - 新增 `@arc3dlab/*` 包时，需同步在 `e2e/vite.config.ts` 与 `demo-vue3/vite.config.ts` 的 `resolve.alias` 中补别名；否则 `npm run test:e2e` 或 5173 Sandcastle 预览会报 `Failed to resolve import`（P3 加入 `@arc3dlab/plotting` 后 e2e 已补，demo-vue3 曾遗漏导致 5173 预览白屏）。
  - 移除 `@arc3dlab/*` 包时，需同步清理：`tsconfig.json` `paths`、`typedoc.json` `entryPoints`、`scripts/api-docs/config.mjs` `PACKAGE_DISPLAY`、`scripts/release-gate.mjs` 的 `PUBLIC_EXPORT_NAMES` 与包依赖边界表、`packages/README.md`、两处 `resolve.alias`、根入口 re-export；再跑 `npm install --package-lock-only` 与 `node scripts/release-gate.mjs exports:update` 刷新 lockfile 与 API 基线（`checkWorkspaceAliases` 会校验 tsconfig 与 `packages/*` 一致）。
  - 公共 API 是两层 barrel：发布入口 `src/index.ts`（`scripts/release-gate.mjs` 的 `PUBLIC_ENTRIES["."]`，精选 re-export）与内部完整 barrel `packages/sdk/src/index.ts`。新增公共符号必须同时改这两处，再跑 `node scripts/release-gate.mjs exports:update` 刷新 `scripts/public-api-manifest.json`，否则 `lint:exports` 报 `public API ... added`。
  - Playwright 浏览器已预装（`~/.cache/ms-playwright/chromium-1194`），可直接运行 `npm run test:e2e`（`playwright test`），webServer 使用端口 4310。

[Project Knowledge Summary]
- Date: 2026-10-11
- Context: Discovered by Agent while finishing the migration gates (P6)
- Category: Build Methods
- Instructions:
  - 门禁分层：`npm run gate:fast` = `typecheck && test && lint:deps && lint:exports && lint:license && lint:api && format:check`；`npm run gate:release` = 快速层（改用 `test:coverage`）+ `lint:audit && docs:build && lint:docs && guide:build && build && lint:size && bench:check && test:pack`；`npm run gate` 是 `gate:fast` 的别名。
  - 覆盖率阈值分两层：`vitest.config.ts` 既有全局阈值，也有按包阈值（`packages/*/src/**`，覆盖 core/analysis/ui/scene/data/interaction/effects/sdk）。新增或调整阈值需以 `coverage/coverage-summary.json` 实测值为基线取略低值。
  - `npm run bench:check`（`scripts/benchmark.mjs --check`）以四个确定性工作负载（渲染规模/分析负载/地形采样/创建销毁循环）做宽松绝对预算断言，已纳入 `gate:release` 与 CI；调整预算需同步 `BUDGETS_MS` 与 `tests/unit/benchmark.test.ts`。

[User Instruction Summary]
- Date: 2026-10-12
- Context: CI / gate 推送后失败（lint:exports 报 API 签名变化），用户要求此后每次推送强制执行检查
- Instructions:
  - 每次 `git push` 前必须强制执行完整检查；仓库已跟踪 `.githooks/pre-push`，运行 `npm run gate:release`，失败则中止推送。
  - `package.json` 的 `prepare` 会执行 `git config core.hooksPath .githooks` 自动启用钩子；紧急跳过用 `SKIP_PREPUSH_CHECK=1`（CI 仍会检查）。
  - 提交/推送前不要依赖本地 `dist` 缓存判断；必须走门禁命令。

[Project Knowledge Summary]
- Date: 2026-10-12
- Context: Discovered by Agent while diagnosing a CI gate failure: 本地 `lint:exports` 通过，但 CI 报 `public API signature changed: . Map / . Viewer`
- Category: Troubleshooting & Debugging
- Instructions:
  - 根因：`scripts/release-gate.mjs` 用 TypeScript 打印跨模块类型时会产出 `import("/abs/path").Type`，绝对路径随机器变化（本地 `/workspace`、CI `/home/runner/work/...`），导致签名基线与机器绑定。
  - 修复：`collectEntrySurface` 对每个签名套用 `toPortable()`，把 `${ROOT}/` 改写为 `./`；`scripts/public-api-manifest.json` 需用 `node scripts/release-gate.mjs exports:update` 重新生成。
  - 验证：把仓库复制到另一路径（软链 node_modules）运行 `node scripts/release-gate.mjs exports` 应通过；manifest 中不应出现绝对根路径。

[Project Knowledge Summary]
- Date: 2026-10-12
- Context: Discovered by Agent while adding the P2-01 consumer type test (`scripts/pack-smoke.mjs` 的 `tsc --noEmit`) and finding the published `dist/index.d.ts` 含方法实现体与语法错误
- Category: Build Methods
- Instructions:
  - 发布用的 `.d.ts` 不能只靠 `vite-plugin-dts` 的 `rollupTypes`：api-extractor 会沿 tsconfig `paths`/`baseUrl` 解析到源码 `.ts` 并内联实现体（`ae-wrong-input-file-type`），产出非法声明文件。
  - 现方案：`vite.config.ts` 只用 `vite-plugin-dts` 生成逐文件 `.d.ts`（`rollupTypes` 关闭），再由 `scripts/rollup-dts.mjs`（`npm run build` 末尾）先去掉别名改写的 `.ts` 扩展名，然后用 `@microsoft/api-extractor` + `tsconfig.rollup.json`（`baseUrl: ./dist`）打包成 `dist/index.d.ts`、`dist/engine-cesium.d.ts`。
  - `scripts/rollup-dts.mjs` 用 `Extractor.invoke({ localBuild: true })`，否则 release 级的 `@alpha/@public` 缺失警告会被当作错误导致 `succeeded: false`。
  - 验证发布类型：`npm run build && npm run test:pack`。

[User Instruction Summary]
- Date: 2026-10-12
- Context: 旧版内容收敛任务完成并推送后，用户指示提交/推送权限
- Instructions:
  - 后续除非用户明确给出提交或推送代码的指令，不得自主执行 `git commit`、`git push` 等提交/推送操作。
  - 可以在任务过程中完成改动与本地校验，但提交与推送需等待用户显式指令。

[Project Knowledge Summary]
- Date: 2026-10-13
- Context: Discovered by Agent while expanding `demo-vue3` Sandcastle examples and running its `vue-tsc -b` check
- Category: Troubleshooting & Debugging
- Instructions:
  - `demo-vue3` 不在根 `tsconfig.json` 的 include 内，根 `npm run typecheck`（`tsc --noEmit`）不会检查它；demo 单独用 `cd demo-vue3 && npx vue-tsc -b` 校验。
  - demo 依赖的是 npm 上发布的 `arc3dlab@0.0.3`，其 `dist/index.d.ts` 不含 `Arc3D`/`Arc3DApp`，直接 `import { Arc3D } from "arc3dlab"` 会报 TS2305。
  - 不要给 `demo-vue3/tsconfig.app.json` 加 `@arc3dlab/*` 或 `arc3dlab` 的 `paths`（指向 `../packages/*/src` 或 `../src`）：会把整个 monorepo 源码拉进 demo 更严格的编译选项（`erasableSyntaxOnly`、`noUncheckedIndexedAccess`、`noUnusedLocals`）下并产生大量无关错误；`@arc3dlab/*` 在 `node_modules` 里是工作区符号链接，`types` 指向 `src/index.ts`，同样会被拉入。
  - 现行方案：`src/arc3dlab-shim.d.ts` 用 `declare module "arc3dlab"` 声明 demo 用到的门面；`runner.ts` 用 `import.meta.glob("../../packages/{...}/src/index.ts", { eager: true })` 在运行期拿工作区命名空间（Vite 会打包），类型上保持 `any`，从而 `vue-tsc` 不再拉入 packages 源码。
  - 校验命令：`cd demo-vue3 && npx vue-tsc -b --force`；5173 预览由 `npx vite --host` 提供，`.monkeycode-ai.online` 已在 `allowedHosts`。

[User Instruction Summary]
- Date: 2026-10-13
- Context: 用户对 Sandcastle 示例提出的强制迭代要求
- Instructions:
  - Sandcastle 中所有示例必须支持 FPS 的控制显示，这是强制规定；该能力已在 `demo-vue3/src/runner.ts` 的 `mountFpsMeter` 中统一挂载（每个示例自动获得 FPS 开关与实时读数），示例代码内不要再自行添加 FPS 开关。
  - `Polygon`、`Points`、`Polyline` 示例需绘制多个图形，并提供 GUI 控制面板，支持修改对应图形 SDK 支持的全部样式参数（面：fill/outline/outlineColor/outlineWidth/clampToGround；点：color/outlineColor/pixelSize/outlineWidth/clampToGround；线：color/width/clampToGround），并在样式变更时按 `remove` 后重建的方式重绘以规避样式不可变限制。

[Project Knowledge Summary]
- Date: 2026-10-13
- Context: Discovered by Agent while debugging Sandcastle primitive 渲染与 glTF 资源加载
- Category: Troubleshooting & Debugging
- Instructions:
  - `GroundPolylinePrimitive` / `Primitive` 渲染折线时 appearance 必须用 `PolylineColorAppearance`；`PerInstanceColorAppearance` 会在 `createCommands` 读取 `material._uniforms` 而崩溃。适用 `packages/graphics/src/graphic-manager.ts` 的折线 primitive 与多边形轮廓 primitive 分支。
  - `app.graphics.addModel({url})` 的外部模型必须带 `Access-Control-Allow-Origin`；`sandcastle.cesium.com/SampleData/...` 无 CORS 头，可用 `cesium.com/downloads/cesiumjs/releases/<version>/Apps/SampleData/...` 或 raw.githubusercontent.com 对应 tag 路径。

[User Instruction Summary]
- Date: 2026-10-13
- Context: 用户为 Sandcastle 示例缩略图提出规格要求（首张为 Hello World，用于避免示例增多后首页加载变慢）
- Instructions:
  - 示例缩略图统一为 `260×85`、`AVIF` 格式，并尽量压缩体积；编码参数可用 sharp：`avif({ quality: 40, effort: 9, chromaSubsampling: "4:2:0" })`。
  - 存放目录 `demo-vue3/src/assets/thumbnails/<id>.avif`，在 `catalog.ts` 的示例对象用可选字段 `thumbnail`（`import` 资源 URL）引用。
  - 未提供 `thumbnail` 的示例由 `ExampleGallery` 回退到渐变占位（`span.thumb`），有缩略图则渲染 `<img class="thumb">`（`object-fit: cover`、`loading="lazy"`）。

[Project Knowledge Summary]
- Date: 2026-10-18
- Context: Discovered by Agent while adding the Firefox Playwright project and validating Cesium WebGL E2E
- Category: Troubleshooting & Debugging
- Instructions:
  - Firefox 无头模式不提供 WebGL/WebGL2，Cesium 初始化报 `WebGL initialization failed`；需在 `xvfb-run -a` 下以 `headless: false` 运行，并设置 `webgl.force-enabled` / `webgl2.force-enabled` / `gfx.webrender.software` 与 `LIBGL_ALWAYS_SOFTWARE=1`、`MOZ_WEBRENDER=1`。
  - `npm run test:e2e` 固定跑 Chromium，Firefox 用 `npm run test:e2e:firefox`；CI 安装 `chromium firefox`，Firefox 步骤包一层 `xvfb-run -a`，perf 趋势只跑 Chromium。
