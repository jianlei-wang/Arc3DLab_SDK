# 通视与可视域

可见性分析位于 `app.analysis.visibility`，需要地形数据。

## 两点通视

```ts
const sight = await app.analysis.visibility.lineOfSight({
  from: [116.391, 39.907, 30],
  to: [116.45, 39.93, 20],
  samples: 64,
})

console.log(sight.visible) // 是否通视
console.log(sight.occludedIndex) // 被遮挡的采样点索引
console.log(sight.samples) // 逐点采样
```

## 可视域

```ts
const viewshed = await app.analysis.visibility.viewshed({
  observer: [116.391, 39.907, 0],
  radius: 2000,
  rays: 72,
  observerHeight: 2,
  samples: 32,
  draw: true, // 绘制可视域范围
})

console.log(viewshed.visibleCount, "/", viewshed.rayCount)
console.log(viewshed.rays) // 每条射线的可见性与射程
```

清除绘制：

```ts
app.analysis.visibility.clearOverlay()
```

## 参数速查

`lineOfSight`：`from`、`to`、`samples?`、`signal?`、`maxSamples?`。

`viewshed`：`observer`、`radius`、`rays?`、`observerHeight?`、`samples?`、`draw?`、`signal?`、`onProgress?`、`maxSamples?`。

两者插值方式为 `ecef-chord`（弦线）。

相关：[任务契约](/analysis/tasks)。
