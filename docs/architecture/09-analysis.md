# Analysis 模块

Updated: 2026-10-09

Analysis 是 Arc3DLab 的核心竞争力域。第一阶段提供测量骨架，后续按 Capability 扩展。

```ts
await app.analysis.measure.distance({ positions })
await app.analysis.measure.area({ positions, holes, mode })
await app.analysis.measure.height({ from, to })
await app.analysis.measure.horizontalDistance({ from, to })
await app.analysis.measure.verticalDistance({ from, to })
await app.analysis.measure.heading({ from, to })
await app.analysis.measure.spaceAngle({ from, via, to })
```

单位约定：长度米、面积平方米、体积立方米、角度度。高程基准为椭球高，缺失高程按 0。

`distance` 为 ECEF 三维直线距离。`horizontalDistance` 为椭球面测地线距离。`height` / `verticalDistance` 为两点椭球高差。`heading` 为正北起算、顺时针方位角（0–360°）。`area` 默认球面多边形面积，可选 `mode: "planar"` 局部东-北投影；`holes` 从外环面积中扣除。

## 地形

```ts
await app.analysis.terrain.sampleHeight({ position })
await app.analysis.terrain.slope({ position, sampleMeters: 20 })
await app.analysis.terrain.profile({ positions, samples: 32 })
app.analysis.terrain.setExaggeration(2)
```

`sampleHeight` 优先 `scene.sampleHeightMostDetailed`，回退 `globe.getHeight`。`slope` 用东/北偏移点有限差分，返回坡度（度）与坡向（正北起算、顺时针）。
`setExaggeration` 写入 `scene.verticalExaggeration`。

采样结果带 `source` 与 `status`：`sampleHeight` 为真实采样，`globe` 为 Globe 高程，`ellipsoid` 为无地形时的椭球高 0。`status` 为 `sampled` / `fallback` / `unavailable` / `cancelled`。分析任务支持 `signal` 取消、`onProgress` 进度、`maxSamples` 上限；地形采样依赖 Cesium scene，在主线程分块让出，不使用 Worker。

## 通视

```ts
await app.analysis.visibility.lineOfSight({ from, to, samples: 32 })
await app.analysis.visibility.viewshed({ observer, radius, rays: 36, observerHeight: 2 })
```

`lineOfSight` 沿视线插值，比较线高与地形高。`viewshed` 径向通视采样，返回每条射线 `rangeMeters`。`draw: true` 用贴地扇区 Primitive 画出可见包络。

视线按 ECEF 弦插值，包含地球曲率。`viewshed` 观察点高程为地形高加 `observerHeight`（默认 2 米），射线间隔为 `360 / rays` 度，远端点取观察点处地形高。

## 体积

```ts
await app.analysis.volume.cutFill({ positions, samples: 16, designHeight })
await app.analysis.volume.excavate({ positions, depth: 20 })
app.analysis.volume.clear()
```

`cutFill` 在多边形内网格采样，相对设计高程累计挖方 / 填方（立方米）。`excavate` 用 Globe 多边形剖切加底部水平面表示开挖。

`cutFill` 使用局部东-北投影网格，边界单元按覆盖率加权，并返回 `resolutionMeters` 与 `estimatedErrorCubicMeters`。`excavate` 在 `depth > 0` 时启用多边形剖切加 ENU 底面，形成有深度的 Globe 开挖体；`depth = 0` 仅为表面多边形裁切，`volumetric` 为 false。

## 空间查询

```ts
await app.analysis.query.rectangle({ west, south, east, north, relation })
await app.analysis.query.polygon({ positions, relation })
await app.analysis.query.distance({ position, meters })
```

查询 Graphic 几何关系，默认 `relation: "intersect"`。矩形/多边形支持点在范围内、线段相交、面相交；`within` 要求全部顶点落在查询几何内。`west > east` 的矩形按跨日界线拆分。距离查询使用点到顶点、线段或面（含内部）的椭球面最短距离。返回 `{ id, type }[]`。

## 剖切

```ts
app.analysis.clip.setPlane({ origin, heading })
app.analysis.clip.setBox({ west, south, east, north })
app.analysis.clip.setPolygon({ positions })
app.analysis.clip.list()
app.analysis.clip.clear()
```

Plane / Box 使用 Globe `ClippingPlaneCollection`。Polygon 使用 `ClippingPolygonCollection`。`app.destroy()` 回收剖切。
