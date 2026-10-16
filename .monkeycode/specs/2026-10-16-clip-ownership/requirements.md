# Requirements Document

## Introduction

`@arc3dlab/analysis` 的 `ClipAnalysis`（`packages/analysis/src/clip.ts`）基于 Cesium `Globe` 的 `clippingPlanes` 与 `clippingPolygons` 实现剖切与开挖，但当前实现存在状态不同步与资源所有权缺陷：

- **状态与场景不一致**：`setExcavation()` 收到少于三个顶点的输入时，只把内部 `active` 清空并记录一个空的开挖结果，却不撤销此前已应用到场景的裁剪。于是 `list()` 返回空数组，而场景中仍存在旧的裁剪平面/多边形。
- **被替换的集合未释放**：`clearPolygons()` 用新的空集合替换 `globe.clippingPolygons`，但不释放被替换的集合；`setPolygon()` / `setExcavation()` 也直接替换 `globe.clippingPolygons`。
- **共享状态被无条件接管**：裁剪分析直接改写 `Globe` 的共享槽位。若调用者在创建 `Arc3DApp` 之前已设置裁剪，或另一子系统也在使用裁剪，SDK 的 `clear()` / `destroy()` 会清理不属于自己的状态。

本特性为裁剪对象建立明确的所有权规则：SDK 创建的集合由 SDK 释放；外部既有状态被捕获并在适当时机恢复；输入无效时旧状态保持有效。

范围决策（已确认）：

- **无效输入的语义**：`setExcavation()` / `setPolygon()` 在顶点少于 3 个时抛出 `Arc3DError("INVALID_ARGUMENT")`，并在任何场景变更之前校验，旧裁剪与 `list()` 保持有效。
- **外部既有状态的语义**：在首次写入前捕获 `globe.clippingPlanes` / `globe.clippingPolygons` 作为基线，`clear()` / `destroy()` 时只释放 SDK 自身创建的集合并恢复捕获的基线引用。
- **改造范围**：仅 `packages/analysis/src/clip.ts` 及其测试与文档。

## Glossary

- **Clip（裁剪）**：通过 `ClippingPlaneCollection` 或 `ClippingPolygonCollection` 对 Globe 渲染进行的剖切/开挖效果。
- **Baseline（基线）**：在 SDK 首次写入裁剪槽位之前，Globe 上既有的 `clippingPlanes` / `clippingPolygons` 引用，可能为 `undefined`，也可能由调用者或其它子系统创建。
- **Owned Collection（自有集合）**：由 `ClipAnalysis` 创建并当前挂载到 Globe 槽位上的集合。
- **Excavation（开挖）**：由裁剪多边形与底面裁剪平面组合构成的剖切效果。

## Requirements

### Requirement 1: 状态与场景一致

**User Story:** AS 使用裁剪分析的开发者, I want `list()` 反映场景中真实生效的裁剪, so that 状态描述与实际渲染一致。

#### Acceptance Criteria

1. WHEN 任意设置方法成功返回, THE `ClipAnalysis.list()` SHALL 返回与当前实际挂载到 Globe 的裁剪效果相对应的裁剪类型。
2. WHEN 任意设置方法因输入无效而未执行, THE `ClipAnalysis.list()` SHALL 保持调用前的取值。
3. WHEN `clear()` 或 `destroy()` 返回, THE `ClipAnalysis.list()` SHALL 返回空数组且场景中不再存在 SDK 创建的裁剪效果。

### Requirement 2: 输入校验先于状态变更

**User Story:** AS 使用裁剪分析的开发者, I want 无效输入被拒绝且不破坏现有裁剪, so that 我能安全地纠正参数。

#### Acceptance Criteria

1. WHEN `setPolygon()` 收到少于三个顶点的 `positions`, THE 该方法 SHALL 抛出 `Arc3DError`，错误码为 `INVALID_ARGUMENT`。
2. WHEN `setExcavation()` 收到少于三个顶点的 `positions`, THE 该方法 SHALL 抛出 `Arc3DError`，错误码为 `INVALID_ARGUMENT`。
3. WHEN 上述校验失败, THE 该方法 SHALL 在修改任何 Globe 槽位或内部状态之前抛出，保证旧裁剪仍然有效。

### Requirement 3: 裁剪对象所有权

**User Story:** AS 需要与其它裁剪使用者共存的开发者, I want SDK 只管理自己创建的裁剪对象, so that 我的外部裁剪状态不被破坏。

#### Acceptance Criteria

1. WHEN `ClipAnalysis` 首次写入裁剪槽位, THE SDK SHALL 捕获当时的 `globe.clippingPlanes` 与 `globe.clippingPolygons` 作为 Baseline。
2. WHEN SDK 替换自己创建的裁剪平面集合, THE SDK SHALL 释放被替换的自有集合。
3. WHEN SDK 替换自己创建的裁剪多边形集合, THE SDK SHALL 解除对被替换的自有集合的引用。
4. WHEN `clear()` 或 `destroy()` 执行, THE SDK SHALL 释放全部自有集合，并恢复 Baseline 引用。
5. WHEN `clear()` 或 `destroy()` 在从未写入裁剪槽位的情况下执行, THE SDK SHALL 不修改 Globe 槽位。
6. THE SDK SHALL NOT 释放或修改非自有的集合（Baseline 或其它子系统创建的集合）。

### Requirement 4: 设置方法的一致性

**User Story:** AS 使用裁剪分析的开发者, I want 各设置方法遵循同一所有权与状态规则, so that 行为可预测。

#### Acceptance Criteria

1. WHEN `setPlane()` / `setBox()` 成功, THE 场景 SHALL 仅挂载对应的自有裁剪平面集合，且多边形槽位恢复为 Baseline。
2. WHEN `setPolygon()` 成功, THE 场景 SHALL 仅挂载对应的自有裁剪多边形集合，且平面槽位恢复为 Baseline。
3. WHEN `setExcavation()` 以 `depth <= 0` 成功, THE 场景 SHALL 仅挂载开挖多边形集合。
4. WHEN `setExcavation()` 以 `depth > 0` 成功, THE 场景 SHALL 同时挂载开挖多边形集合与底面裁剪平面集合。
5. WHEN 从一种裁剪模式切换到另一种, THE SDK SHALL 释放前一模式的自有集合，且不释放 Baseline。
