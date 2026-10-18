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

| 方法                              | 结果           | 关键字段                        |
| --------------------------------- | -------------- | ------------------------------- |
| `distance` / `horizontalDistance` | `LengthResult` | `meters`、`mode`、`heightDatum` |
| `area`                            | `AreaResult`   | `squareMeters`、`mode`          |
| `height` / `verticalDistance`     | `HeightResult` | `meters`、`heightDatum`         |
| `heading` / `spaceAngle`          | `AngleResult`  | `degrees`                       |

高的基准为椭球高（`heightDatum: "ellipsoid"`）。

## 精度与适用边界

- 输入为 WGS84 经纬度（度）与椭球高（米）。投影坐标（UTM、Web Mercator、地方坐标系）与正高/大地水准面转换由调用方在进入 SDK 前完成，SDK 不内置投影或垂直基准转换。
- `distance` 返回 ECEF 三维弦长；`horizontalDistance` 与默认面积使用球面近似；`mode: "planar"` 使用局部东-北平面。结果的 `model` 字段标明实际数值模型。
- 局部平面模型以首个顶点为原点固定 `cos(lat)`，适用于目标附近、非极区的小范围。高纬、大范围经向跨度或近极点会明显失真。
- 多边形按简单环处理：不检测自相交、不修复拓扑、不归一化环方向；孔洞面积始终从外环扣除。跨日界线的面积与矩形查询有展开/拆分处理，复杂跨线几何仍需调用方复核。
- 地形缺失通过 `source` / `status` 标识，`unavailable` 与回退高程不会被当作真实测量值。土方 `cutFill` 额外返回 `terrain` 计数，`unavailable > 0` 表示部分体积按椭球高 0 计算，应结合该计数判读结果。

详细模型与误差说明见架构文档的「计算模型与适用边界」。

## 任务形式

每个测量方法都有对应的 `*Task()` 版本，返回统一的 `AnalysisResult`，支持取消与进度，见[任务契约](/analysis/tasks)：

```ts
const result = await app.analysis.measure.distanceTask({ positions })
if (result.status === "succeeded") console.log(result.value.meters)
```

相关：[地形分析](/analysis/terrain)。
