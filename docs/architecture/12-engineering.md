# 工程化

Updated: 2026-10-10

## 构建

Vite library mode + TypeScript + `vite-plugin-dts`。主产物为 ESM。UMD 降为可选 legacy bundle。

库构建 `base: "./"`，静态资源以 `new URL(..., import.meta.url)` 生成模块相对 URL，兼容直接 ESM 引用与消费端打包。

## 体积与静态资源

- `bundle-baseline.json` 记录 `dist/arc3dlab.esm.js` 与 `dist/engine-cesium.js` 的 raw / gzip 基线；`npm run lint:size`（CI 在 `build` 后执行）超出基线 5% 时失败。
- 默认底图 `globe.jpg` 以 `?url&no-inline` 单独产出到 `dist/`，仅在创建默认底图时按需加载，不再内联进 JS chunk；`lint:size` 校验必需资源存在且禁止在大 JS 中内联超过阈值（`inlineImageLimitBytes`）的 base64 图片。
- `npm run lint:audit`（`npm audit --omit=dev --audit-level=high`）扫描运行时依赖漏洞。

## 包版本

- 当前发布：单一包 `arc3dlab`
- 内部包：`@arc3dlab/core` 等，`private: true`
- Cesium peer：`1.146.0`
- Active 矩阵：Arc3DLab 1.0.x + Cesium 1.146.0

## 许可证

源码 `LICENSE` 为 GNU GPL v2。`package.json` 与 README 必须与 `LICENSE` 文件一致，使用 `GPL-2.0-only`。

CesiumJS 采用 Apache-2.0，第三方底图、示例数据需要在 `NOTICE.md` 声明。

## 分发策略

| 分发形态 | 许可证影响 | 结论 |
|---|---|---|
| 开源项目集成 | 与 GPL-2.0-only 兼容 | 直接使用 |
| 闭源商业产品静态链接 | 触发 GPL 传染，需整体 GPL 或商业授权 | 需评估商业授权 |
| 独立部署的 Web 服务 | 未分发二进制，GPL 义务边界较窄 | 合规审查后使用 |
| 二次分发 / SaaS 转售 | 受 GPL-2.0-only 约束 | 需商业授权 |

- 发布产物只包含 `dist/`、`LICENSE`、`NOTICE.md`、`README.md`，见 `package.json` 的 `files`。
- `npm run gate` 的 `lint:license` 校验 `package.json` 与 `LICENSE` / `NOTICE.md` 一致。
- 商业闭源或二次分发场景需另行获取授权；在完成授权方案前，对外默认按 GPL-2.0-only 分发。


## 测试

- Unit：core 的 EventBus / Lifecycle / Registry / ID
- Integration：Arc3DApp destroy 回收
- 覆盖率：`npm run test:coverage`（v8）。全仓最低阈值 lines/statements 60、functions 58、branches 75；`core`、`engine-cesium`、`analysis` 等核心包在 `vitest.config.ts` 中另有不低于当前基线的按包阈值，CI 以 `test:coverage` 替代 `test`
- E2E：`npm run test:e2e`（Playwright + Chromium，SwiftShader 无头 WebGL）。`e2e/app.spec.ts` 覆盖主链路（创建 → 添加 Graphic → 拾取 → 测量分析 → 销毁 → 重建）与失败路径（初始化失败、清理失败、多实例并行、长任务取消、外部服务成功/失败模拟）

## CI 门禁

`.github/workflows/ci.yml`（`permissions: contents: read`）包含独立 job：

- `gate`：`typecheck` → `test:coverage` → `lint:deps` → `lint:exports` → `lint:license` → `lint:api` → `lint:audit` → `docs:build` → `lint:docs` → `format:check` → `build` → `lint:size` → `bench:check` → `test:pack`
- `docs`：构建 API 文档并上传 `api-docs` 构件
- `guide`：构建 VitePress 开发指南并上传 `guide-dist` 构件
- `e2e`：`npm ci` → `playwright install --with-deps chromium` → `test:e2e`，失败时上传 `playwright-report`

本地分层门禁：`npm run gate:fast`（类型检查 + 单测 + 依赖/导出/许可/API 边界 + 格式）；`npm run gate:release`（快速层改用 `test:coverage`，叠加 `lint:audit`、`docs:build`、`lint:docs`、`guide:build`、`build`、`lint:size`、`bench:check`、`test:pack`）；`npm run gate` 是 `gate:fast` 的别名。浏览器 E2E 始终单独运行。

推送前强制检查：仓库跟踪 `.githooks/pre-push`，在每次 `git push` 前运行 `npm run gate:release`，失败即中止推送。`package.json` 的 `prepare` 脚本在安装依赖时执行 `git config core.hooksPath .githooks` 自动启用该钩子；`.githooks/prepare-commit-msg` 负责 co-author 注入。紧急情况下可设置 `SKIP_PREPUSH_CHECK=1` 跳过（CI 仍会执行同样检查）。

## 责任归属与分支保护

- `.github/CODEOWNERS` 按域划分评审人：公共 API / 生命周期 / 渲染（Cesium）/ GIS 算法 / CI 与发布。
- 目标分支启用必需状态检查：`gate`、`docs`、`guide`、`e2e` 四个 job 全部通过，并要求至少一项代码审阅后合并。
- 分支保护与必需检查属于 GitHub 仓库设置，需由仓库管理员在 GitHub UI 或 API 配置；仓库内的 `CODEOWNERS` 与默认分支约定为唯一事实来源。

开发命令、即时测试、预览、API 文档生成和 npm 发布步骤见 `docs/guides/sdk-development.md`。
