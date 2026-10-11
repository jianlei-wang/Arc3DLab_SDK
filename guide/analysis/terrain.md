# 地形分析

地形分析位于 `app.analysis.terrain`，需要先设置地形（见[地形](/imagery-terrain/terrain)）。

## 高程采样

```ts
const sample = await app.analysis.terrain.sampleHeight({
  position: [116.391, 39.907],
  signal: controller.signal, // 可选
})
console.log(sample.height, sample.source, sample.status)
```

## 坡度与坡向

```ts
const slope = await app.analysis.terrain.slope({
  position: [116.391, 39.907],
  sampleMeters: 20, // 采样间距，默认 20
})
console.log(slope.height, slope.slopeDegrees, slope.aspectDegrees)
```

## 剖面

沿折线采样地形剖面：

```ts
const { points } = await app.analysis.terrain.profile({
  positions: [
    [116.36, 39.88],
    [116.46, 39.93],
  ],
  samples: 64,
})

// points: { longitude, latitude, height, distance }[]
```

## 高程夸张

```ts
app.analysis.terrain.setExaggeration(2)
console.log(app.analysis.terrain.getExaggeration())
```

## 取消与进度

长任务可传入 `signal` 与 `onProgress`，并可用 `maxSamples` 限制采样规模：

```ts
await app.analysis.terrain.profile({
  positions: line,
  samples: 128,
  maxSamples: 200,
  onProgress: (p) => console.log(p),
})
```

相关：[通视与可视域](/analysis/visibility)、[任务契约](/analysis/tasks)。
