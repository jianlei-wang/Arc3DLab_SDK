# 最终产物同步 设计文档

Updated: 2026-10-16

## 目标

对 SDK 包、API 文档、Sandcastle 与开发指南做一次最终一致性核对，修复发现的偏差，并保证四者均可构建；随后提交并推送。

## 检查与改动

### SDK 包

- 核对根 `src/index.ts` 导出与 `scripts/public-api-manifest.json`：`lint:exports` / `lint:api` 通过，无需改动。
- `npm run build` 产出 `dist/arc3dlab.esm.js` 与声明文件，`declaration rollup ok`。

### API 文档

- `npm run docs:build` 生成 533 页 / 520 符号，覆盖 12 个包命名空间。
- 修复提取告警：`packages/graphics/src/dynamic/materials.ts` 的 `RadarNormalMaterialProperty.getValue` 首个参数为未使用（`_time`），但 JSDoc 仍标注 `@param time`，导致 `@param with name "time" not used`。删除该 `@param` 行，使注释与签名一致；修复后构建无告警。
- `npm run lint:docs` 覆盖率 summary 100.0% / params 98.6%。

### Sandcastle（`demo-vue3`）

- 校验示例代码字符串中全部 `sdk.*` 引用（`createFireParticle` / `createExplosionParticle` / `createWaterGunParticle`、`addSpreadPoint` / `addRadarNormal` / `addCircleDiffusion` / `addDynamicPolyline` / `addBillboard` / `addPanel` / `ModelFlatten`、`NavigationBar`、`captureGrid`、`createGaodeProvider`）均在各包 `src/index.ts` 导出。
- 身份对齐：`package.json` 包名 `my-vue-app` → `arc3dlab-sandcastle`，并同步 `package-lock.json` 的名称字段。
- 依赖收敛：Sandcastle 通过 `vite.config.ts` 的 `resolve.alias` 把 `arc3dlab` / `@arc3dlab/*` 指向工作区源码，运行时不经由已发布 npm 包；删除 `package.json` 与 `package-lock.json` 中过期的 `arc3dlab@^0.0.3` 依赖（对应锁定项一并移除），保持 `package.json` 与 lock 同步。
- 类型垫片：更新 `src/arc3dlab-shim.d.ts` 注释，说明示例消费工作区源码、垫片仅服务于 `vue-tsc`，不再引用已发布 `0.0.3`。
- `README.md` 重写为 Sandcastle 说明与本地工作区消费方式，移除 Vue 脚手架模板残留文案。

### 开发指南（`guide/`）

- 复核源码 markdown 未使用已移除 API（`Viewer` 仅出现在迁移页作旧代码对照；`dependsOn` 已替换为 `dependsOnPlugins`）。
- `PeerLinks.vue` 端口映射（Sandcastle 5173 / API 5174 / 指南 5175）与 `docs/architecture/11-api.md` 描述一致。
- `npm run guide:build` 通过。

## 决策

- 不修改任何包源码的公共导出（仅修正 JSDoc），`scripts/public-api-manifest.json` 不需刷新。
- Sandcastle 去掉 npm 依赖而非改版本号：仓库发布的 SDK 版本（本地 2.0.0）与 npm registry（0.0.4）不同步，声明工作区源码消费才是真实合同。
- 迁移与历史文档中的旧 `Viewer` 示例保留为对照。

## 验证

- `npm run build`、`npm run docs:build`、`npm run lint:docs`、`npm run guide:build`、`demo-vue3` 的 `npm run build`。
- `npm run gate:fast`：typecheck、86 文件 / 571 通过 | 1 跳过、deps/exports/license/api/format 门禁全绿。

## 回滚

逐文件 `git checkout -- <file>`；Sandcastle 依赖删除可通过恢复 `package.json` / `package-lock.json` 撤销。
