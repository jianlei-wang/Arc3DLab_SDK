# 兼容性与版本策略

Updated: 2026-10-12

## 模块格式

`arc3dlab` 与 `arc3dlab/engine-cesium` 均为 **ESM-only**：

- 通过 `import` 加载，`exports` 仅声明 `types` 与 `import`，不提供 `require` 出口。
- 构建目标为现代打包器（Vite / Rollup / webpack 5 ESM）与 Node `>=22` ESM。
- 不支持 CommonJS `require("arc3dlab")`；如需在 CJS 环境使用，请通过动态 `import()`。
- 发布合同由 `scripts/pack-smoke.mjs` 覆盖运行时导入与 `.d.ts` 消费者类型编译。

## 渲染引擎定位

采用 **Cesium-first**：`core` 不依赖 Cesium，业务包可直接依赖 `cesium`；`Engine` 为内部生命周期/能力接缝，多渲染后端为长期路线图，不构成当前 API 合同（详见 `docs/architecture/03-engine.md`）。

## 兼容矩阵

| Arc3DLab | Cesium | Node | 状态 |
|---|---|---|---|
| 2.0.x | 1.146.0 | >=22 | Active |
| 1.0.x | 1.146.0 | >=22 | Legacy（旧版兼容入口仍可用） |
| 0.x | 1.136.0 | >=20 | Legacy |

peerDependencies 精确锁定为 `cesium@1.146.0`。

## 旧版内容移除（1.x → 2.0）

2.0.0 移除了以下旧版兼容资产，属于 SemVer Major 破坏性变更：

| 已移除符号 | 归属 | 迁移路径 |
|---|---|---|
| `Viewer` / `Map` / `LegacyViewerOptions` / `LegacyMapOptions` | 根入口与 `@arc3dlab/legacy` 包 | `Arc3D.create()` / `Arc3D.createSync()`，见 `docs/architecture/13-migration.md` |
| `Arc3DPlugin.dependsOn` | `@arc3dlab/sdk` | 能力依赖使用 `requiresCapabilities`，插件依赖使用 `dependsOnPlugins` |
| `AnalysisWorkerHost` | `@arc3dlab/analysis` | 使用 `AnalysisJobHost` |

迁移窗口：1.x 期间旧版符号保持可用；自 2.0.0 起仅保留当前契约符号，消费者需在升级前完成迁移。

## 依赖锁定策略

- **精确锁定**：`cesium` 通过 `peerDependencies` 精确锁定，避免 core 私有 API 漂移导致的运行时差异。
- **支持范围**：`@arc3dlab/*` 内部包随主包一起发布，不单独发版，消费者不感知内部版本。
- **构建期**：`vite` / `typescript` / `vitest` 采用 `^` 范围，仅影响开发与构建，不进入运行时合同。

### Cesium 内部 API 依赖（升级高风险点）

SDK 直接依赖以下 Cesium 内部实现入口，它们带下划线、不属于 Cesium 公开 API，也不属于 Arc3DLab 的稳定公开合同，**不得被无限期依赖**。升级 `cesium` 时必须逐项核查。

| 内部 API | 使用位置 | 用途 |
|---|---|---|
| `Material._materialCache.addMaterial` / `getMaterial` | `packages/effects/src/materials.ts`（动态扩散、线尾迹）、`packages/graphics/src/dynamic/materials.ts`（雷达） | 注册自定义材质类型 |

- **原因**：Cesium 1.146.0 未提供公开的材质注册 API，`Material.fromType` 自身也消费同一内部缓存。
- **缓解措施**：
  - `cesium` 在 `peerDependencies` 中精确锁定为 `1.146.0`，降低近期不兼容概率。
  - 注册入口以 `if (!cache) return` 守卫访问，结构缺失时静默跳过而非抛错。
  - `tests/integration/cesium-material-registration.test.ts` 针对锁定版本做版本契约集成测试：探针缓存结构、校验三类材质进入缓存、并复用 Cesium 真实编译路径（`Material.fromType`）。
  - 升级流程：升级 `cesium` → 运行该集成测试与浏览器 E2E → 若失败，更新访问层与测试后重新锁定版本。

## SemVer 承诺范围

| 变更类型 | 版本位 | 示例 |
|---|---|---|
| 公共 API 破坏性变更 | Major | 移除或改名根入口导出、改变 Manager 方法签名 |
| 向后兼容新增 | Minor | 新增 Manager 方法、新增可选配置字段、新增语义类型 |
| 修复与内部实现 | Patch | 缺陷修复、性能优化、内部类型重构 |

纳入 SemVer 保证的公共合同：根入口与 `@arc3dlab/sdk` 的命名导出、`Arc3DApp` 及其 Managers（`graphics` / `layers` / `data` / `scene` / `interaction` / `analysis` / `effects` / `ui` / `terrain`）的方法签名、`packages/core` 语义类型。

不纳入 SemVer 保证：`app.native.viewer` 及 `native` / `scene` / `camera` / `canvas` 逃生舱、`@arc3dlab/*/src/*` 内部模块、`tests/fixtures` 与 `examples`。

## 变更管理流程

1. 公共 API 变更先更新 `docs/architecture/11-api.md` 与 `CHANGES.md`。
2. 破坏性变更必须补充 `docs/architecture/13-migration.md` 迁移指引。
3. `npm run gate` 中的 `lint:exports` 校验发布入口与 `exports` 字段一致性，`lint:api` 阻止消费者深路径导入。
