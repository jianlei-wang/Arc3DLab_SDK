# 空间分析增强

在既有量测、地形、通视与查询之外，`@arc3dlab/analysis` 新增缓冲、路径渲染、热力图与洪水分析。

## 缓冲区

纯几何函数返回首尾闭合的 WGS84 环：

```ts
import { bufferPoint, bufferPolyline, bufferPolygon } from "@arc3dlab/analysis"

const ring = bufferPoint({ longitude: 116.39, latitude: 39.9 }, 500)
```

`BufferService` 提供面向应用的封装。

## 路径与路况

`RouteOverlay` 按 `PathSegment.status` 着色渲染路径：

```ts
import { RouteOverlay, formatRouteSummary } from "@arc3dlab/analysis"

const route = new RouteOverlay(app.context)
route.render(pathResult, { /* 样式 */ })
formatRouteSummary(pathResult)
route.clear()
```

## 热力图

```ts
import { HeatmapOverlay, DynamicHeatmapOverlay } from "@arc3dlab/analysis"

const heatmap = new HeatmapOverlay(app.context)
heatmap.setData(points)
heatmap.setType(3)
heatmap.setOptions({ radius: 20 })

const dynamic = new DynamicHeatmapOverlay(app.context)
dynamic.init(points, options)
dynamic.updateNoise(values)
```

`interpolateHeatmapGrid`、`computeHeatmapGrid`、`gridToRgba` 与 `sampleGradient` 为纯函数，便于在无引擎环境复用。

## 洪水分析

```ts
import { FloodAnalysis } from "@arc3dlab/analysis"

const flood = new FloodAnalysis(app.context)
flood.setRegion(positions)
flood.setWaterLevel(25, { /* FloodWaterOptions */ })
flood.clear()
```

洪水水面以区域裁剪 + 后处理着色实现。

## 卷帘对比

```ts
import { SwipeComparison } from "@arc3dlab/analysis"

const swipe = new SwipeComparison(app.context, "vertical")
swipe.addLayer(imageryLayer, "left")
swipe.setPosition(0.5)
swipe.destroy()
```

当前仅支持竖直方向的分割。

相关：[测量](/analysis/measure)、[剖切与开挖](/analysis/clip)。
