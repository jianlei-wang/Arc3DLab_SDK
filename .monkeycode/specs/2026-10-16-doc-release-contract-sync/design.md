# 文档与发布合同同步 设计文档

Updated: 2026-10-16

## 目标

把 README、开发指南、迁移文档、架构文档与 `CHANGES.md` 统一到 `2.0.0` 合同，消除旧版兼容入口、版本号与 Cesium 依赖边界的残留描述。仅文档变更，不触碰代码与公共 API manifest。

## 受影响文件与改动

| 文件 | 位置 | 改动 |
|---|---|---|
| `README.md` | 兼容旧入口示例 | 移除 `Viewer` 示例，改为「旧入口已在 2.0.0 移除，使用 `Arc3D.create()`」并用迁移文档作参照 |
| `docs/guides/sdk-development.md` | 概览版本 | `1.0.0` → `2.0.0`（两处：概览、版本与日志） |
| 同上 | 仓库结构 | 删除 `legacy/`，补 `plotting/`；`engine-cesium/` 说明去掉「唯一」 |
| 同上 | 依赖方向图 | 删除 `sdk -> legacy`，改为 `sdk` |
| 同上 | 依赖边界 | 改为 Cesium-first 事实，列允许直接依赖 `cesium` 的包，指出 `CESIUM_PACKAGES` 门禁 |
| 同上 | 单元测试覆盖 | 由「仅 `packages/core`」改为反映多包现状 |
| 同上 | 版本与发布 | 预发布号与 tag 示例改为 `2.0.0` / `v2.0.0` |
| `docs/architecture/12-engineering.md` | 包版本 Active 矩阵 | `1.0.x` → `2.0.x` |
| `docs/guides/migration.md` | 顶部 | 增加 `Viewer` / `Map` 已于 2.0.0 移除的声明 |
| `CHANGES.md` | 版本头 | `## Unreleased - 2026-10-12` → `## v2.0.0 - 2026-10-12` |
| 同上 | `chore` 段 | 新增本次文档同步条目 |
| `docs/architecture/CHANGELOG.md` | 新条目 | 新增 2026-10-16 文档/发布合同同步记录 |

## 关键决策

- **保留历史示例**：`docs/guides/migration.md`、`docs/architecture/13-migration.md`、`guide/migration/viewer.md` 中的旧 `Viewer` 用法与 `1.0.0-alpha.1` 属历史对照，仅补充移除状态声明，不删除。
- **单一真值来源**：Cesium 依赖边界以 `docs/architecture/03-engine.md` 与 `scripts/release-gate.mjs` 的 `CESIUM_PACKAGES` 为准，开发指南改为引用而非自行断言。
- **不动门禁产物**：本次不涉及导出变更，无需 `scripts/release-gate.mjs exports:update`。

## 验证方式

1. 检索上述文件，确认不再出现作为当前合同表述的 `legacy/`、`sdk -> legacy`、当前版本 `1.0.0`、`Cesium 只出现在 engine-cesium`、Active 矩阵 `1.0.x`。
2. `npm run format:check`。
3. 可选 `npm run guide:build` 确认 VitePress 站点仍可构建。

## 回滚

纯文本变更，`git checkout -- <file>` 即可回滚。
