# 点

点图形通过 `app.graphics` 创建。

## 单个点

```ts
const point = app.graphics.addPoint({
  positions: { longitude: 116.391, latitude: 39.907, height: 0 },
  style: { color: "#ff3b30", pixelSize: 12, clampToGround: true },
})
```

## 批量点

```ts
const points = app.graphics.addPoints({
  positions: [
    [116.391, 39.907],
    [121.473, 31.230],
    [113.264, 23.129],
  ],
  style: { color: "#2f80ed", pixelSize: 10 },
})
```

## 图形句柄

`addPoint` / `addPoints` 返回 `Graphic`：

```ts
point.visible = false
point.setStyle({ color: "#00b894", pixelSize: 16 })
point.setPositions({ longitude: 117, latitude: 40, height: 0 })
point.remove()
```

| 成员 | 说明 |
| --- | --- |
| `id` | 图形 ID。 |
| `renderMode` | 实际采用的渲染模式。 |
| `positions` | 经纬高序列。 |
| `setStyle(style)` | 更新样式。 |
| `setPositions(positions)` | 更新坐标。 |
| `remove()` | 移除并释放。 |

## 选项 `GraphicCreateOptions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 图形 ID，未提供时自动生成。 |
| `positions` | `PositionInput \| PositionInput[]` | 坐标。 |
| `style` | `GraphicStyle` | 样式。 |
| `renderMode` | `"auto" \| "entity" \| "primitive" \| "buffer"` | 期望渲染模式。 |
| `dynamic` | `boolean` | 是否需要动态更新。 |
| `properties` | `Record<string, unknown>` | 附加属性。 |

相关：[样式与批量更新](/graphics/style)。
