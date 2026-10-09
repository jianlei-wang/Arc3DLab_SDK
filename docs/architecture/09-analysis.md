# Analysis 模块

Updated: 2026-10-08

Analysis 是 Arc3DLab 的核心竞争力域。第一阶段提供测量骨架，后续按 Capability 扩展。

```ts
await app.analysis.measure.distance({ positions })
await app.analysis.measure.area({ positions })
await app.analysis.measure.height({ from, to })
await app.analysis.measure.horizontalDistance({ from, to })
await app.analysis.measure.verticalDistance({ from, to })
await app.analysis.measure.heading({ from, to })
await app.analysis.measure.spaceAngle({ from, via, to })
```

`distance` 为三维直线距离。`horizontalDistance` 为椭球面距离。`height` / `verticalDistance` 为两点椭球高差。`heading` 为正北起算方位角（度）。

## 地形

```ts
await app.analysis.terrain.sampleHeight({ position })
await app.analysis.terrain.slope({ position, sampleMeters: 20 })
await app.analysis.terrain.profile({ positions, samples: 32 })
app.analysis.terrain.setExaggeration(2)
```

`sampleHeight` 优先 `scene.sampleHeightMostDetailed`，回退 `globe.getHeight`。`slope` 用东/北偏移点有限差分，返回坡度（度）与坡向（正北起算、顺时针）。
`setExaggeration` 写入 `scene.verticalExaggeration`。

## 通视

```ts
await app.analysis.visibility.lineOfSight({ from, to, samples: 32 })
await app.analysis.visibility.viewshed({ observer, radius, rays: 36, observerHeight: 2 })
```

`lineOfSight` 沿视线插值，比较线高与地形高。`viewshed` 径向通视采样，返回每条射线 `rangeMeters`。`draw: true` 用贴地扇区 Primitive 画出可见包络。

## 体积

```ts
await app.analysis.volume.cutFill({ positions, samples: 16, designHeight })
await app.analysis.volume.excavate({ positions, depth: 20 })
app.analysis.volume.clear()
```

`cutFill` 在多边形内网格采样，相对设计高程累计挖方 / 填方（立方米）。`excavate` 用 Globe 多边形剖切加底部水平面表示开挖。

## 空间查询

```ts
await app.analysis.query.rectangle({ west, south, east, north })
await app.analysis.query.polygon({ positions })
await app.analysis.query.distance({ position, meters })
```

查询 Graphic 顶点：矩形范围、多边形包含、球面距离。返回 `{ id, type }[]`。

## 剖切

```ts
app.analysis.clip.setPlane({ origin, heading })
app.analysis.clip.setBox({ west, south, east, north })
app.analysis.clip.setPolygon({ positions })
app.analysis.clip.list()
app.analysis.clip.clear()
```

Plane / Box 使用 Globe `ClippingPlaneCollection`。Polygon 使用 `ClippingPolygonCollection`。`app.destroy()` 回收剖切。
