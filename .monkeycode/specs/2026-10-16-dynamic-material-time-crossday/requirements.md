# Requirements Document

## Introduction

`packages/effects/src/materials.ts` 的动态扩散材质（`DynamicSpreadMaterialProperty`）与线尾迹材质（`PolylineTrailMaterialProperty`）用 `JulianDate.secondsOfDay` 记录动画起点（`epoch`）并计算已经流逝的时间。`secondsOfDay` 取值范围为 `[0, 86400)`，在每天结束时回绕；一旦动画持续跨过午夜，`time.secondsOfDay - epoch` 会突变甚至变成负数，导致动画重置或倒退。此外两个 `equals()` 只比较了颜色与另一项配置，遗漏了影响结果的 `duration`，使配置不同但被判为相等的属性无法触发材质重建。

本特性：

- 用能正确计算跨日差值的 `JulianDate.secondsDifference` 替换 `secondsOfDay` 差值，并将 `epoch` 保存为独立副本（含 `dayNumber`）。
- 让两个 `equals()` 覆盖全部影响结果的配置字段。

范围外：改动 shader、动画相位语义（`time` 仍以「周期数」为单位并可为任意大）、以及 `packages/graphics/src/dynamic/materials.ts` 的雷达材质（基于 `czm_frameNumber`，无此缺陷）。

## Glossary

- **epoch**：材质属性首次求值时锁定的动画起点时刻。
- **周期数（periods）**：`time` 的单位，`elapsedMs / duration`，可超过 1，由 shader 用 `fract` 取相位。
- **回绕（Wrap）**：`secondsOfDay` 在午夜由 `~86399` 变回 `0` 的现象。

## Requirements

### Requirement 1: 动画时间跨日正确

**User Story:** AS 使用动态材质的开发者, I want 动画时间以完整日期的差值计算, so that 跨过午夜的动画不会重置或倒退。

#### Acceptance Criteria

1. WHEN 属性首次 `getValue(time)` 被调用, THE 该实例 SHALL 保存 `time` 的独立 `JulianDate` 副本（含 `dayNumber`）作为 epoch。
2. WHEN `getValue(time)` 在 epoch 之后（含跨越午夜）被调用, THE 返回的 `time` SHALL 等于 `JulianDate.secondsDifference(time, epoch) * 1000 / duration`。
3. WHEN 求值时刻跨过午夜, THE 返回的 `time` SHALL 随真实经过时间单调递增, SHALL NOT 回绕为更小或负值。
4. WHEN 调用方在首次求值后就地修改传入的 `JulianDate` 实例, THE 已保存的 epoch SHALL NOT 随其改变。
5. WHEN 首次求值, THE 返回的 `time` SHALL 为 `0`。

### Requirement 2: 相等性覆盖全部影响结果的配置

**User Story:** AS 使用动态材质的开发者, I want 相等性比较覆盖所有影响结果的字段, so that 配置不同的属性不会被误判为相等。

#### Acceptance Criteria

1. WHEN 比较两个 `DynamicSpreadMaterialProperty`, THE `equals()` SHALL 同时比较颜色、`gradient` 与 `duration`。
2. WHEN 比较两个 `PolylineTrailMaterialProperty`, THE `equals()` SHALL 同时比较颜色、`image` 与 `duration`。
3. WHEN 两个属性的任一被比较字段不同, THE `equals()` SHALL 返回 `false`。
4. WHEN 与自身比较或与字段逐一相等的同类属性比较, THE `equals()` SHALL 返回 `true`。
