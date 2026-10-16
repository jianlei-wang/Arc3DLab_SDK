# Requirements Document

## Introduction

`@arc3dlab/plotting` 的 `PlottingManager.draw()`（`packages/plotting/src/plotting-manager.ts`）负责把一个符号的几何图元逐条落地为场景实体，并把结果写入内部 `items` 记录。当前实现对「结果 ID」与「创建过程」都不够健壮：

- **创建无回滚**：`shapes.map((shape) => this.materialize(...))` 先创建底层实体，之后才构造 `PlotResult` 并写入 `items`。一个符号可能产出多个图元（例如 `circle`、`flag`、`formation` 等面状符号同时生成面与轮廓），若第 N 个 `materialize` 抛错，前 N-1 个已创建的实体既没有记录也不会被清理，成为无法追踪的孤儿实体。
- **重复 ID 覆盖记录**：`id = options.id ?? createId("plot")` 后直接 `items.set(id, result)`。当调用者复用一个既有 ID 时，旧记录被新记录覆盖，而旧记录的底层实体仍在场景中；此后 `removeAll()` / `remove(id)` 只能按新记录清理，旧实体永久残留。

本特性为 `draw()` 建立原子化创建语义：ID 在创建任何原生对象之前校验，创建过程使用暂存集合，全部成功后再提交记录，任一步失败则统一回滚已创建的原生对象并保持内部记录不变。

范围决策（已确认）：

- **重复 ID 语义**：`draw()` 在创建任何实体之前校验 ID。同一 `PlottingManager` 内已存在相同 ID 时抛出 `Arc3DError("DUPLICATE_RESOURCE")`，不覆盖既有记录、不创建任何实体。
- **空 ID 语义**：显式提供的 `options.id` 必须为非空字符串，否则抛出 `Arc3DError("INVALID_ARGUMENT")`；未提供时沿用 `createId("plot")`。
- **失败回滚语义**：创建过程中任一实体创建失败时，回滚本次已创建的全部实体，不写入 `items`，并原样重抛错误。
- **改造范围**：仅 `packages/plotting/src/plotting-manager.ts` 及其测试与文档；不改动公共 API 签名。

## Glossary

- **PlotResult（标绘结果）**：`draw()` 的返回值，含 `id` / `symbol` / `positions` / `shapes` / `entities`。
- **Staging（暂存集合）**：创建过程中用于累积已创建原生对象的本地集合，仅在全部成功后并入 `PlotResult`。
- **Commit（提交）**：将 `PlotResult` 写入 `items` 记录的动作，是 `draw()` 对外可见的唯一状态变更。
- **Rollback（回滚）**：失败时按逆序或逐条移除本次已创建原生对象的动作。
- **Entity（实体）**：由 `materialize()` 通过 `viewer.entities.add()` 创建并返回的底层 Cesium 对象。

## Requirements

### Requirement 1: ID 在创建之前校验

**User Story:** AS 使用标绘的开发者, I want ID 冲突在创建任何实体之前被拒绝, so that 我不会得到无法追踪的残留实体。

#### Acceptance Criteria

1. WHEN `draw()` 收到的 `options.id` 在当前 `PlottingManager` 内已存在, THE `draw()` SHALL 在创建任何实体之前抛出 `Arc3DError`，错误码为 `DUPLICATE_RESOURCE`。
2. WHEN `draw()` 因 ID 冲突抛出, THE `items` 记录 SHALL 保持调用前的取值，既有结果与其实体 SHALL 不受影响。
3. WHEN `draw()` 因 ID 冲突抛出, THE 场景 SHALL NOT 新增任何本次调用的实体。
4. IF `options.id` 被显式提供且不是非空字符串, THEN THE `draw()` SHALL 抛出 `Arc3DError`，错误码为 `INVALID_ARGUMENT`，且不创建任何实体。

### Requirement 2: 创建过程原子化

**User Story:** AS 使用标绘的开发者, I want 创建过程中的失败不留下部分实体, so that 场景与记录始终一致。

#### Acceptance Criteria

1. WHEN `draw()` 创建全部实体成功, THE 该方法 SHALL 提交一条包含全部实体的 `PlotResult` 记录并返回它。
2. WHEN 任一实体创建失败, THE `draw()` SHALL 移除本次已创建的全部实体，并原样重抛该错误。
3. WHEN 任一实体创建失败, THE `items` 记录 SHALL 保持调用前的取值，不写入部分结果。
4. WHEN `draw()` 成功返回, THE 场景中新增的实体数量 SHALL 等于返回结果 `entities` 的长度。

### Requirement 3: 记录与场景一致

**User Story:** AS 使用标绘的开发者, I want `remove()` / `removeAll()` 能够完整清理已提交的记录, so that 清理结果可预测。

#### Acceptance Criteria

1. WHEN `remove(id)` 成功, THE 该方法 SHALL 移除该记录对应的全部实体并从 `items` 中删除该记录。
2. WHEN `removeAll()` 执行, THE 该方法 SHALL 移除全部已提交记录的实体，且不遗留任何被覆盖或部分创建的实体。
3. WHEN `destroy()` 执行, THE 该方法 SHALL 通过 `removeAll()` 清理全部记录并注销标绘工具。

### Requirement 4: 既有行为保持

**User Story:** AS 现有标绘使用者, I want 正常绘制路径与错误语义保持兼容, so that 升级不破坏既有代码。

#### Acceptance Criteria

1. WHEN 符号未知, THE `draw()` SHALL 继续抛出 `Arc3DError("INVALID_ARGUMENT")`。
2. WHEN 锚点不足以生成图元, THE `draw()` SHALL 继续抛出 `Arc3DError("INVALID_ARGUMENT")`，且不创建实体、不写入记录。
3. WHEN 未提供 `options.id`, THE `draw()` SHALL 继续自动生成结果标识。
4. WHEN `draw()` 成功, THE 该方法 SHALL 继续确保标绘工具已注册。
