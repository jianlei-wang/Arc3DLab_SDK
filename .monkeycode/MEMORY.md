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
  - 提交前可先跑 CI 覆盖但 `npm run gate` 不含的步骤：`npm run docs:build`、`npm run guide:build`、`npm run test:e2e`、`npm run lint:size`、`npm run test:pack`。

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
  - 新增 `@arc3dlab/*` 包时，需同步在 `e2e/vite.config.ts` 的 `resolve.alias` 中补别名；否则 `npm run test:e2e` 的 vite dev server 会报 `Failed to resolve import`（P3 加入 `@arc3dlab/plotting` 后即为此遗留问题）。
  - Playwright 浏览器已预装（`~/.cache/ms-playwright/chromium-1194`），可直接运行 `npm run test:e2e`（`playwright test`），webServer 使用端口 4310。

[Project Knowledge Summary]
- Date: 2026-10-11
- Context: Discovered by Agent while finishing the migration gates (P6)
- Category: Build Methods
- Instructions:
  - `npm run gate` 只包含 `typecheck && test && lint:deps && lint:exports && lint:license && lint:api && lint:docs && format:check`；`test:coverage`、`lint:audit`、`lint:size`、`test:pack` 需单独运行（CI 中作为独立步骤）。
