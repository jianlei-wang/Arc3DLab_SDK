# Design Document

## Overview

修复 `packages/effects/src/materials.ts` 两类动态材质的两个合同缺陷：（1）用 `secondsOfDay` 差值计算动画时间导致跨午夜回绕；（2）`equals()` 遗漏 `duration`。改动局限于该类文件与其单测。

## Components and Interfaces

### 时间计算

`epoch` 字段类型由 `number | undefined` 改为 `JulianDate | undefined`，`getValue` 改为：

```ts
getValue(time: JulianDate, result?: MaterialValueResult): MaterialValueResult {
  const value: MaterialValueResult = result ?? {}
  value.color = this.colorValue
  if (this.epoch === undefined) this.epoch = JulianDate.clone(time)
  value.time =
    (JulianDate.secondsDifference(time, this.epoch) * 1000) / this.durationValue
  value.gradient = this.gradientValue
  return value
}
```

要点：

- `JulianDate.secondsDifference(left, right)` 按 `dayNumber` 与 `secondsOfDay` 联合求差，跨日时结果连续，替代原先只用 `secondsOfDay` 的差值。
- 用 `JulianDate.clone(time)` 而非保存 `time` 引用：`viewer.clock.currentTime` 会被 Cesium 就地推进，保存引用会使 epoch 随时钟漂移。两个类都需要把 `JulianDate` 从 `type` 导入改为值导入。
- `time` 的语义（周期数）与默认 `duration = 1000` 不变。

### 相等性

`DynamicSpreadMaterialProperty.equals()` 增加 `this.durationValue === other.durationValue`；`PolylineTrailMaterialProperty.equals()` 同理增加 `duration` 比较。其余字段保持不变。

## Testing Strategy

扩展 `tests/unit/effects-material-properties.test.ts`：

- 跨日单调性：以 `2024-01-01T23:59:59Z` 为起点，前进 2 秒（跨午夜）验证 `time ≈ 2`（`duration` 默认 1000 → 周期数 2），且大于前一时刻的取值。
- epoch 副本：首次求值后原地修改传入的 `JulianDate`，后续求值的时间仍以原 epoch 为基准。
- `equals` 覆盖 `duration`：仅 `duration` 不同的两个属性判为不相等；其它字段相同（含 `duration`）判为相等。

## Risks and Mitigations

- **保存引用导致 epoch 漂移**：已通过 `JulianDate.clone` 规避。
- **长时运行的数值精度**：`time` 为周期数且可持续增长，float 精度随量级下降，但 shader 仅取 `fract`，与既有语义一致，不在本次范围。
