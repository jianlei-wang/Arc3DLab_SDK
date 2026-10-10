# 兼容性与版本策略

Updated: 2026-10-10

## 兼容矩阵

| Arc3DLab | Cesium | Node | 状态 |
|---|---|---|---|
| 1.0.x | 1.146.0 | >=22 | Active |
| 0.x | 1.136.0 | >=20 | Legacy |

peerDependencies 精确锁定为 `cesium@1.146.0`。

## 依赖锁定策略

- **精确锁定**：`cesium` 通过 `peerDependencies` 精确锁定，避免 core 私有 API 漂移导致的运行时差异。
- **支持范围**：`@arc3dlab/*` 内部包随主包一起发布，不单独发版，消费者不感知内部版本。
- **构建期**：`vite` / `typescript` / `vitest` 采用 `^` 范围，仅影响开发与构建，不进入运行时合同。

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
