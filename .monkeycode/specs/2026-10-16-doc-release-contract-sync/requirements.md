# 文档与发布合同同步 需求文档

Updated: 2026-10-16

## 背景

根 `package.json` 版本已为 `2.0.0`；`@arc3dlab/legacy` 包与根入口 `Viewer` / `Map` 导出已移除；SDK 采用 **Cesium-first** 定位（`core` 不依赖 Cesium，其余业务包可直接依赖 `cesium`，边界由 `scripts/release-gate.mjs` 的 `CESIUM_PACKAGES` 门禁固化）。

README、开发指南、迁移文档、架构文档与 `CHANGES.md` 中仍残留旧版描述（`Viewer` 兼容示例、版本号 `1.0.0`、`legacy/` 目录、`sdk -> legacy` 依赖、`Cesium 只出现在 engine-cesium`、Active 矩阵 `1.0.x`），与当前合同不一致，会误导 SDK 使用者与维护者。本次按一次版本合同同步修复处理。

## 术语

- **合同**：当前 `2.0.0` 的版本号、公共入口、Cesium 依赖边界与旧版移除状态。

## 需求

### R1 README 只呈现当前合同入口

- R1.1 THE `README.md` 的入口示例 SHALL 仅使用 `Arc3D.create()`。
- R1.2 WHEN `README.md` 需要说明旧入口, THE `README.md` SHALL 指明 `Viewer` / `Map` 已在 2.0.0 移除，并以迁移文档为参照。

### R2 开发指南对齐当前版本与仓库结构

- R2.1 THE `docs/guides/sdk-development.md` SHALL 记录当前版本 `2.0.0`。
- R2.2 THE `docs/guides/sdk-development.md` 的仓库结构 SHALL NOT 列出 `legacy/`，且 SHALL 覆盖当前实际存在的包。
- R2.3 THE `docs/guides/sdk-development.md` 的依赖方向图 SHALL NOT 包含 `sdk -> legacy`。
- R2.4 THE `docs/guides/sdk-development.md` 的依赖边界说明 SHALL 与 `docs/architecture/03-engine.md` / `00-index.md` 一致：`core` 不依赖 Cesium，列出允许直接依赖 `cesium` 的业务包，并指出该边界由 `CESIUM_PACKAGES` 门禁固化。
- R2.5 THE `docs/guides/sdk-development.md` 的单元测试覆盖描述 SHALL 反映当前多包现状。
- R2.6 THE `docs/guides/sdk-development.md` 的版本与发布示例 SHALL 使用当前主版本号。

### R3 架构文档版本矩阵对齐

- R3.1 THE `docs/architecture/12-engineering.md` 的 Active 矩阵 SHALL 为 `Arc3DLab 2.0.x + Cesium 1.146.0`。

### R4 迁移文档声明移除状态

- R4.1 THE `docs/guides/migration.md` SHALL 声明 `Viewer` / `Map` 已在 2.0.0 移除，示例仅作为旧代码到新合同的映射参照。

### R5 CHANGES.md 版本头对齐

- R5.1 THE `CHANGES.md` 的本版本条目 SHALL 以 `v2.0.0` 为标题，且 SHALL NOT 用 `Unreleased` 承载已定版内容。
- R5.2 THE `CHANGES.md` SHALL 以 `chore` 记录本次文档与发布合同同步。

## 验收标准

- 对上述文件执行检索，不再命中作为**当前合同**表述的旧版残留：`legacy/`、`sdk -> legacy`、当前版本 `1.0.0`、`Cesium 只出现在 engine-cesium`、Active 矩阵 `1.0.x`。
- 迁移与历史文档中作为**历史引用**的 `1.0.0-alpha.1`、旧 `Viewer` 示例允许保留。
- 不修改公共 API manifest 与任何源码。
