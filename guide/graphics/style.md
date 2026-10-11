# 样式与批量更新

## 图形样式 `GraphicStyle`

| 字段 | 类型 | 适用 | 说明 |
| --- | --- | --- | --- |
| `color` | `string` | 点 / 线 | 通用颜色。 |
| `fill` | `string` | 面 | 填充色。 |
| `outline` | `boolean` | 面 | 是否绘制轮廓。 |
| `outlineColor` | `string` | 点 / 面 | 轮廓颜色。 |
| `outlineWidth` | `number` | 点 / 面 | 轮廓宽度（像素）。 |
| `pixelSize` | `number` | 点 | 点像素大小。 |
| `width` | `number` | 线 | 线宽（像素）。 |
| `clampToGround` | `boolean` | 全部 | 是否贴地。 |

更新样式：

```ts
graphic.setStyle({ color: "#ff3b30", pixelSize: 14 })
```

## 渲染模式

`renderMode` 控制底层实现：

| 值 | 说明 |
| --- | --- |
| `auto` | 由运行时根据数量与动态性自动选择（默认）。 |
| `entity` | 使用 Cesium Entity，易于动态编辑。 |
| `primitive` | 使用 Primitive，适合静态大数据量。 |
| `buffer` | 预留的缓冲模式。 |

配合 `dynamic: true` 声明坐标会被频繁更新，帮助运行时选择合适模式。

## 批量操作

```ts
app.graphics.get(id) // 查询
app.graphics.list() // 列出全部
app.graphics.show(id, false) // 单个可见性
app.graphics.showMany(ids, false) // 批量可见性
app.graphics.remove(id) // 单个移除
app.graphics.removeMany(ids) // 批量移除
app.graphics.clear() // 全部移除
```

批量更新坐标：

```ts
app.graphics.updatePositionsBatch([
  { id: "point-1", positions: [116.4, 39.9] },
  { id: "line-1", positions: [[116.4, 39.9], [116.5, 39.95]] },
])
```

## 事件

```ts
app.on("graphicAdded", ({ id, type }) => console.log("added", type, id))
app.on("graphicRemoved", ({ id, type }) => console.log("removed", type, id))
```

相关：[交互与事件](/interaction/events)。
