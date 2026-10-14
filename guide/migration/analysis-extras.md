# 空间分析增强

在既有量测、地形、通视与查询之外，`app.analysis` 还提供缓冲、路径渲染、热力图、洪水与卷帘对比，全部挂在 `app.analysis` 的只读属性上。

## 缓冲区

`app.analysis.buffer` 覆盖点、折线与多边形三种缓冲，返回首尾闭合的 WGS84 环：

```ts
const ring = app.analysis.buffer.point(
  { longitude: 116.39, latitude: 39.9 },
  500,
)
const aroundLine = app.analysis.buffer.polyline(linePositions, 300)
const inner = app.analysis.buffer.polygon(ringPositions, -200) // 负值内缩
```

## 路径与路况

`app.analysis.path` 按分段的 `status` 着色渲染路径，并可选标注总距离与耗时：

```ts
app.analysis.path.render(pathResult, {
  width: 6,
  clampToGround: true,
  showLabel: true,
})

app.analysis.path.setVisible(false)
app.analysis.path.clear()
```

`pathResult` 为 `RouteResult`：`{ distance, duration, segments }`，每个分段含 `positions` 与 `status`（`smooth` / `slow` / `congested` / `severe`）。

## 热力图

`app.analysis.heatmap` 接收 `HeatmapPoint[]`（`{ longitude, latitude, value }`）：

```ts
app.analysis.heatmap.setData(points, {
  radius: 20, // 影响半径（米）
  mode: "2d", // 或 "3d"
})

app.analysis.heatmap.clear()
```

动态热力图用 `app.analysis.dynamicHeatmap` 在多个数据帧间切换与播放：

```ts
app.analysis.dynamicHeatmap.setFrames([{ points: frameA }, { points: frameB }])
app.analysis.dynamicHeatmap.play(500) // 帧间隔（毫秒）
app.analysis.dynamicHeatmap.pause()
```

## 洪水分析

```ts
app.analysis.flood.setRegion(positions)
app.analysis.flood.setWaterLevel(25, { /* FloodWaterOptions */ })
app.analysis.flood.clear()
```

洪水水面以区域裁剪 + 后处理着色实现。

## 卷帘对比

`app.analysis.swipe` 通过场景分割位置控制两侧影像各显示一半：

```ts
app.analysis.swipe.addLayer(leftLayer, "left")
app.analysis.swipe.addLayer(rightLayer, "right")
app.analysis.swipe.setPosition(0.5)
app.analysis.swipe.setActive(false)
```

当前仅支持竖直方向的分割。

相关：[测量](/analysis/measure)、[剖切与开挖](/analysis/clip)。
