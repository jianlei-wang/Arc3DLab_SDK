# Requirements Document

## Introduction

`@arc3dlab/core` 的空间参考工具（`packages/core/src/spatial.ts`）用 `sameSpatialReference()` 判断两个空间参考是否等价，并由 `tryCreateCoordinateTransform()` 据此返回恒等转换。当前实现对「等价性层次」与「单位」处理不够严格：

- **忽略长度单位**：`sameSpatialReference()` 比较 `crs`、`axisOrder` 与 `angularUnit`，但未比较 `linearUnit`。当两个参考使用相同 CRS 却声明不同高程单位（米与英尺）时，它仍判定等价。
- **等价性未分层**：水平方向（CRS、轴序、角度单位）与垂直方向（高程单位/基准）的等价性混在一个布尔判断里，调用方无法区分「坐标系识别」「单位等价」两个层次。
- **等价判断直接决定恒等变换**：`tryCreateCoordinateTransform()` 在 `sameSpatialReference()` 为真时返回恒等转换。由于上一条缺陷，单位不同的参考会被静默当作可直接互用，造成单位换算遗漏。
- **缺少显式报错入口**：SDK 当前不支持真实重投影与单位换算，但除返回 `undefined` 外没有「明确报错」的公共入口，调用方容易忽略 `undefined` 而假定坐标兼容。

本特性严格区分「坐标系识别」「单位等价」「真实坐标变换」三个层次：水平与垂直参考分别提供等价判断；完整等价包含高程长度单位；仅当完整等价时才返回恒等转换，不支持的真实变换以 `Arc3DError("UNSUPPORTED_CAPABILITY")` 明确报错。

范围决策（已确认）：

- **`sameSpatialReference()` 语义**：完整等价 = 水平参考等价 且 高程长度单位等价（`linearUnit`，缺省 `meters`）。这是行为修复，不再把不同长度单位的参考判为等价。
- **分层等价函数**：新增 `sameHorizontalReference(a, b)`（CRS + 轴序 + 角度单位）与 `sameVerticalReference(a, b)`（基准 datum + geoidModel + 长度单位），供调用方按层判断。
- **真实变换边界**：`tryCreateCoordinateTransform()` 仅在完整等价时返回恒等转换，否则返回 `undefined`（签名不变）；新增 `createCoordinateTransform()`，在完整等价时返回恒等转换，否则抛 `Arc3DError("UNSUPPORTED_CAPABILITY")` 且错误信息点明不一致的层次。
- **改造范围**：仅 `packages/core/src/spatial.ts` 与其导出、测试与文档；不改变 `SpatialReference` / `VerticalReference` / `CoordinateTransform` 类型结构。

## Glossary

- **坐标系识别（Identification）**：两个参考是否指向同一 CRS 标识（`crs` 字符串相等）。
- **单位等价（Unit Equivalence）**：角度单位（`angularUnit`）、轴序（`axisOrder`）与长度单位（`linearUnit`）是否一致。
- **真实坐标变换（Real Transform）**：把坐标从一个参考实际换算到另一个参考；SDK 当前只支持恒等变换。
- **水平参考（Horizontal Reference）**：`SpatialReference` 的 `crs` / `axisOrder` / `angularUnit` 三个字段描述的水平坐标语义。
- **垂直参考（Vertical Reference）**：`VerticalReference` 的 `datum` / `geoidModel` / `linearUnit`，以及 `SpatialReference.linearUnit` 所描述的高程单位语义。
- **恒等转换（Identity Transform）**：`forward` / `inverse` 均原样返回坐标的 `CoordinateTransform`。

## Requirements

### Requirement 1: 完整等价包含长度单位

**User Story:** AS 使用空间参考的开发者, I want `sameSpatialReference()` 反映长度单位差异, so that 我不会把不同高程单位的坐标当作可直接互用。

#### Acceptance Criteria

1. WHEN 两个 `SpatialReference` 的 `crs` / `axisOrder` / `angularUnit` 相同但 `linearUnit` 不同, THE `sameSpatialReference()` SHALL 返回 `false`。
2. WHEN 两个 `SpatialReference` 的 `crs` / `axisOrder` / `angularUnit` / `linearUnit` 全部等价（含缺省补全）, THE `sameSpatialReference()` SHALL 返回 `true`。
3. WHEN `linearUnit` 在两侧均未提供, THE `sameSpatialReference()` SHALL 按缺省 `meters` 比较，两者视为等价。

### Requirement 2: 水平与垂直等价分层

**User Story:** AS 使用空间参考的开发者, I want 分别判断水平与垂直方向的等价性, so that 我能区分坐标系识别与单位差异。

#### Acceptance Criteria

1. WHEN 两个水平参考的 `crs` / `axisOrder` / `angularUnit` 等价, THE `sameHorizontalReference()` SHALL 返回 `true`，且其判断 SHALL NOT 受 `linearUnit` 影响。
2. WHEN 两个垂直参考的 `datum` / `geoidModel` / `linearUnit` 等价, THE `sameVerticalReference()` SHALL 返回 `true`。
3. WHEN `sameSpatialReference()` 返回 `true`, THEN `sameHorizontalReference()` SHALL 返回 `true` 且两侧的 `linearUnit` SHALL 等价。

### Requirement 3: 真实变换边界明确

**User Story:** AS 使用空间参考的开发者, I want 仅在同参考下得到恒等变换, so that 单位或坐标系差异不会被静默忽略。

#### Acceptance Criteria

1. WHEN 源与目标完整等价, THE `tryCreateCoordinateTransform()` SHALL 返回恒等转换，其 `source` 与 `target` SHALL 为调用传入的两个参考。
2. WHEN 源与目标不完全等价（含仅长度单位不同）, THE `tryCreateCoordinateTransform()` SHALL 返回 `undefined`。
3. WHEN 源与目标完整等价, THE `createCoordinateTransform()` SHALL 返回恒等转换。
4. WHEN 源与目标不完全等价, THE `createCoordinateTransform()` SHALL 抛出 `Arc3DError`，错误码为 `UNSUPPORTED_CAPABILITY`，且错误信息 SHALL 指明不一致的层次（CRS / 轴序 / 角度单位 / 长度单位）。
5. IF `createCoordinateTransform()` 抛出, THEN THE 该方法 SHALL NOT 返回恒等转换或任何转换结果。

### Requirement 4: 既有语义保持

**User Story:** AS 现有使用者, I want 未涉及单位差异的既有行为保持兼容, so that 升级不破坏既有代码。

#### Acceptance Criteria

1. WHEN `crs` / 轴序 / 角度单位均不同, THE `sameSpatialReference()` / `tryCreateCoordinateTransform()` SHALL 继续返回 `false` / `undefined`。
2. WHEN 调用 `identityTransform(reference)`, THE 返回值的 `source` 与 `target` SHALL 均为传入参考，`forward` / `inverse` SHALL 原样返回坐标。
3. WHEN `assertGeographicPosition()` 作用于投影参考, THE 该方法 SHALL 继续抛出 `Arc3DError("UNSUPPORTED_CAPABILITY")`。
