# 线

折线至少需要 2 个坐标点。

## 单条折线

```ts
const line = app.graphics.addPolyline({
  positions: [
    [116.391, 39.907],
    [116.5, 39.95],
    [116.6, 39.9],
  ],
  style: { color: "#f2994a", width: 3, clampToGround: true },
})
```

## 批量折线

`addPolylines()` 接收选项数组，并按整体数量统一选择渲染模式，适合大数据量场景：

```ts
const lines = app.graphics.addPolylines([
  { positions: [a, b], style: { color: "#eb5757" } },
  { positions: [c, d], style: { color: "#27ae60" } },
])
```

## 更新坐标

```ts
line.setPositions([
  [116.391, 39.907],
  [116.55, 39.98],
])
```

## 提示

- `width` 为像素宽度。
- 需要被地形遮挡时开启 `clampToGround` 并配合地形深度测试；贴地折线适合表达道路、边界。
- 高频更新时用 `setPositions()`，避免重复创建。

相关：[样式与批量更新](/graphics/style)。
