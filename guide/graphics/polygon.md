# 面

多边形至少需要 3 个坐标点。

## 单个多边形

```ts
const polygon = app.graphics.addPolygon({
  positions: [
    [116.36, 39.88],
    [116.42, 39.88],
    [116.42, 39.93],
    [116.36, 39.93],
  ],
  style: {
    fill: "#2d9cdb",
    outline: true,
    outlineColor: "#1b6ca8",
    clampToGround: true,
  },
})
```

## 批量多边形

```ts
const polygons = app.graphics.addPolygons([
  { positions: ringA, style: { fill: "#27ae60" } },
  { positions: ringB, style: { fill: "#eb5757" } },
])
```

## 更新

```ts
polygon.setStyle({ fill: "#9b51e0", outlineWidth: 2 })
polygon.setPositions(newRing)
```

## 样式字段（面常用）

| 字段 | 说明 |
| --- | --- |
| `fill` | 填充色。 |
| `outline` | 是否绘制轮廓。 |
| `outlineColor` | 轮廓颜色。 |
| `outlineWidth` | 轮廓宽度（像素）。 |
| `clampToGround` | 是否贴地。 |

## 面积计算

需要面积数值时使用分析服务，见[测量](/analysis/measure) 的 `app.analysis.measure.area()`。

相关：[样式与批量更新](/graphics/style)。
