# Requirements Document

## Introduction

`Arc3DLab SDK` 在从旧版 `LarkExplorer-SDK` 迁移过程中，保留了一组面向旧版 API 形状的兼容资产，用于降低既有业务的迁移成本。这些资产包括：兼容适配器包 `@arc3dlab/legacy`（`Viewer` / `Map` 类）及根入口再导出、插件契约中的废弃字段 `Arc3DPlugin.dependsOn`、分析包中的兼容别名 `AnalysisWorkerHost`，以及配套迁移文档与构建别名。

这些兼容资产已进入只修复缺陷、不新增能力的冻结状态。本特性定义其收敛路径：在 `2.0.0` 版本线中按阶段移除旧版内容，使公共 API 只保留当前契约符号，并同步发布门禁、API 基线与迁移文档。

范围决策（已确认）：

- **版本定位为 2.0.0（Major）**：移除根入口导出与包属于破坏性变更，按 `COMPATIBILITY.md` 的 SemVer 承诺提升主版本。
- **先产出计划设计文档，再按阶段执行**：本特性先交付需求与设计文档，经确认后实施。
- **分阶段移除**：先移除内部兼容别名，再移除根入口兼容导出与包，最后同步门禁与文档。
- **保留合法语义**：`packages/core` 中 `commands.ts` 与 `tools.ts` 的 `dependsOn` 表达命令/工具间依赖，语义合法，不在移除范围。

## Glossary

- **Legacy Viewer（旧版查看器）**：`@arc3dlab/legacy` 的 `Viewer` 类，是 `Arc3DApp` 的兼容适配器。
- **Legacy Map（旧版地图）**：`@arc3dlab/legacy` 的 `Map` 类，是旧版 `LarkExplorer.map` 的兼容适配器。
- **Compatibility Alias（兼容别名）**：为保持旧名称可用而保留的再导出符号，如 `AnalysisWorkerHost`。
- **Deprecated Field（废弃字段）**：已标注 `@deprecated` 的接口成员，如 `Arc3DPlugin.dependsOn`。
- **Public API Manifest（公共 API 基线）**：`scripts/public-api-manifest.json`，记录发布入口的导出符号、类型与签名。
- **Release Gate（发布门禁）**：`npm run gate:release`，串联类型检查、测试、导出校验与 API 基线比对。
- **Sunset（收敛）**：将旧版兼容资产从代码、构建与文档中移除并切换消费者到新合同的过程。

## Requirements

### Requirement 1: 废弃标记强化

**User Story:** AS 迁移中的开发者, I want 明确的废弃标记与替代指引, so that 我可以在移除版本到来前完成迁移。

#### Acceptance Criteria

1. WHEN 消费者查看旧版符号的类型声明, THE SDK SHALL 在对应 JSDoc 中提供 `@deprecated` 标记与替代 API 名称。
2. THE SDK SHALL 在 `COMPATIBILITY.md` 中声明每个旧版符号的目标移除版本。
3. WHILE 版本处于移除版本之前, THE SDK SHALL 保持旧版符号的行为语义不变。
4. WHEN 旧版兼容资产被使用, THE `docs/architecture/13-migration.md` SHALL 提供旧成员与当前合同的逐项映射。

### Requirement 2: 内部兼容别名移除

**User Story:** AS SDK 维护者, I want 移除无对外承诺的内部兼容别名, so that 公共表面只保留唯一正式名称。

#### Acceptance Criteria

1. WHEN `2.0.0` 发布, THE `@arc3dlab/analysis` 包 SHALL 仅导出 `AnalysisJobHost` 作为任务宿主名称。
2. WHEN `2.0.0` 发布, THE `Arc3DPlugin` 契约 SHALL 仅通过 `requiresCapabilities` 与 `dependsOnPlugins` 声明依赖。
3. WHEN 别名被移除, THE 仓库内引用别名的样例与测试 SHALL 更新为使用正式名称。
4. WHEN 别名被移除, THE `packages/sdk/src/plugins.ts` SHALL 停止从 `dependsOn` 回退解析能力依赖。

### Requirement 3: 根入口兼容导出移除

**User Story:** AS SDK 维护者, I want 根入口只暴露当前契约, so that 消费者无法再依赖旧版 API 形状。

#### Acceptance Criteria

1. WHEN `2.0.0` 发布, THE 根入口 `src/index.ts` SHALL 仅导出当前契约符号。
2. WHEN `2.0.0` 发布, THE `@arc3dlab/legacy` 包 SHALL 从 workspace 配置与构建别名中移除。
3. WHEN 根入口停止导出旧版符号, THE `docs/architecture/13-migration.md` SHALL 记录已移除符号及迁移方式。
4. WHEN 消费者从旧版入口迁移, THE 开发者指南 SHALL 提供 `Arc3D.create()` 的等价示例。

### Requirement 4: 发布门禁与合同同步

**User Story:** AS SDK 维护者, I want 移除后发布门禁全绿且基线与版本一致, so that 发布合同可验证。

#### Acceptance Criteria

1. WHEN 破坏性移除完成, THE `scripts/public-api-manifest.json` SHALL 重新生成并与发布入口导出一致。
2. WHEN 破坏性移除完成, THE `package.json` 的 `version` SHALL 设置为 `2.0.0`。
3. WHEN 破坏性移除完成, THE `CHANGES.md` SHALL 记录破坏性变更条目与迁移指引链接。
4. WHEN 破坏性移除完成, THE `npm run gate:release` SHALL 通过。

### Requirement 5: 分阶段执行与可回退

**User Story:** AS SDK 维护者, I want 每阶段独立可验证, so that 出现问题时可以定位并回退到阶段边界。

#### Acceptance Criteria

1. THE 收敛过程 SHALL 划分为「废弃标记强化」「内部别名移除」「根入口移除」「合同与文档同步」四个阶段。
2. WHEN 单个阶段完成, THE 仓库 SHALL 通过 `npm run gate:fast` 与 `npm run test:e2e`。
3. WHEN 破坏性阶段完成, THE 提交 SHALL 以单一阶段为单位，便于独立回退。
4. WHEN 构建别名被移除, THE `demo-vue3/vite.config.ts` 与 `e2e/vite.config.ts` SHALL 同步移除旧版包别名。

### Requirement 6: 消费者迁移窗口

**User Story:** AS 迁移自旧版 SDK 的开发者, I want 清晰的迁移窗口说明, so that 我可以在截止版本前完成切换。

#### Acceptance Criteria

1. THE `COMPATIBILITY.md` SHALL 描述 `1.x` 到 `2.0` 的迁移窗口与截止版本。
2. WHEN 开发者查阅迁移章节, THE 文档 SHALL 提供旧版 `Viewer` / `Map` 成员到 `Arc3DApp` 合同的对照表。
3. WHEN 某个旧版能力在当前 SDK 无等价合同, THE 文档 SHALL 明确标注不支持范围与替代路径。
