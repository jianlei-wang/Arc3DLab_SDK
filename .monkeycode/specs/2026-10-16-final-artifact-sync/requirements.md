# 最终产物同步（SDK 包 / API 文档 / Sandcastle / 开发指南）需求文档

Updated: 2026-10-16

## 背景

任务 1-16 累积改动完成后，需要一次最终一致性检查，确保四类对外产物互相一致且均可正常工作：

- **SDK 包**：根 `package.json`、`src/index.ts`、`dist` 产物与 `scripts/public-api-manifest.json`。
- **API 文档**：`npm run docs:build` 产出的静态站点与 `docs/architecture/11-api.md` 策展文档。
- **Sandcastle**：`demo-vue3` 交互式示例（`src/examples/catalog.ts` 中的示例代码字符串）。
- **开发指南**：`guide/`（VitePress）与 `docs/guides/sdk-development.md`。

## 需求

### R1 四类产物均可构建

- R1.1 THE SDK 包 SHALL 可通过 `npm run build` 产出 ESM 与声明文件。
- R1.2 THE API 文档站 SHALL 可通过 `npm run docs:build` 构建，且 `npm run lint:docs` 通过。
- R1.3 THE Sandcastle SHALL 可通过 `npm run build`（`vue-tsc` + `vite build`）构建。
- R1.4 THE 开发指南 SHALL 可通过 `npm run guide:build` 构建。

### R2 公共 API 引用一致

- R2.1 THE Sandcastle 示例引用的 `sdk.*` 符号 SHALL 由对应包的 `src/index.ts` 实际导出。
- R2.2 THE API 文档 JSDoc SHALL 与源码签名一致，不得出现未使用 `@param` 等提取告警。
- R2.3 THE 开发指南引用的公共符号 SHALL 与根入口导出一致。

### R3 Sandcastle 身份与依赖描述一致

- R3.1 THE `demo-vue3/package.json` 的包名 SHALL 反映其为 Arc3DLab Sandcastle。
- R3.2 THE Sandcastle 通过 Vite alias 消费工作区 SDK 源码，SHALL NOT 将已发布的 `arc3dlab` npm 包声明为运行时依赖。
- R3.3 THE `demo-vue3/README.md` SHALL 描述 Sandcastle 的用途与本地工作区消费方式，不保留脚手架模板文案。

### R4 记录与门禁

- R4.1 THE 本次同步 SHALL 记录到 `CHANGES.md`（面向使用者）与 `docs/architecture/CHANGELOG.md`（面向维护者）。
- R4.2 THE `npm run gate:fast` SHALL 通过。

## 验收标准

- `npm run build`、`npm run docs:build`、`npm run lint:docs`、`npm run guide:build`、`demo-vue3` 的 `npm run build` 全部成功。
- `npm run gate:fast` 全绿（typecheck、测试、deps/exports/license/api/format 门禁）。
