# 测量

测量服务位于 `app.analysis.measure`，方法均返回 Promise。

## 距离

```ts
const { meters } = await app.analysis.measure.distance({
  positions: [
    [116.391, 39.907],
    [116.5, 39.95],
  ],
})
```

## 面积

```ts
const { squareMeters, mode } = await app.analysis.measure.area({
  positions: ring,
  holes: [holeRing], // 可选
  mode: "geodesic", // 可选
})
```

## 高度与水平/垂直距离

```ts
await app.analysis.measure.height({ from: a, to: b })
await app.analysis.measure.verticalDistance({ from: a, to: b })
await app.analysis.measure.horizontalDistance({ from: a, to: b })
```

## 方位角与空间角

```ts
await app.analysis.measure.heading({ from: a, to: b })
await app.analysis.measure.spaceAngle({ from: a, via: b, to: c })
```

## 结果类型

| 方法 | 结果 | 关键字段 |
| --- | --- | --- |
| `distance` / `horizontalDistance` | `LengthResult` | `meters`、`mode`、`heightDatum` |
| `area` | `AreaResult` | `squareMeters`、`mode` |
| `height` / `verticalDistance` | `HeightResult` | `meters`、`heightDatum` |
| `heading` / `spaceAngle` | `AngleResult` | `degrees` |

高的基准为椭球高（`heightDatum: "ellipsoid"`）。

## 任务形式

每个测量方法都有对应的 `*Task()` 版本，返回统一的 `AnalysisResult`，支持取消与进度，见[任务契约](/analysis/tasks)：

```ts
const result = await app.analysis.measure.distanceTask({ positions })
if (result.status === "succeeded") console.log(result.value.meters)
```

相关：[地形分析](/analysis/terrain)。
