# 土方计算

土方计算位于 `app.analysis.volume`，按多边形范围统计挖方与填方。

## 挖填量

```ts
const result = await app.analysis.volume.cutFill({
  positions: ring,
  samples: 32, // 每边采样数
  designHeight: 50, // 可选，设计高程；缺省取平均高程
})

console.log(result.cutCubicMeters)
console.log(result.fillCubicMeters)
console.log(result.resolutionMeters)
console.log(result.estimatedErrorCubicMeters)
```

| 结果字段 | 说明 |
| --- | --- |
| `cutCubicMeters` | 挖方量（立方米）。 |
| `fillCubicMeters` | 填方量（立方米）。 |
| `designHeight` | 实际使用的设计高程。 |
| `sampleCount` | 采样点数量。 |
| `resolutionMeters` | 网格分辨率（米）。 |
| `estimatedErrorCubicMeters` | 估算误差。 |

未提供 `designHeight` 时，使用采样点平均高程作为设计面。

## 按多边形与深度开挖

```ts
const excavation = await app.analysis.volume.excavate({
  positions: ring,
  depth: 20,
})
```

## 清理

```ts
app.analysis.volume.clear()
```

## 大范围计算

大范围会显著增加采样量，可通过 `maxSamples` 限制总量：

```ts
await app.analysis.volume.cutFill({ positions: ring, samples: 64, maxSamples: 4000 })
```

相关：[剖切与开挖](/analysis/clip)、[任务契约](/analysis/tasks)。
