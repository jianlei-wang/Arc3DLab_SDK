# 拾取

`app.interaction` 提供屏幕坐标到场景对象的拾取。

## 通用拾取

```ts
const result = app.interaction.pick({ x: 400, y: 300 })

console.log(result.kind) // 命中类型
console.log(result.graphicId) // 命中的图形 ID
console.log(result.layerId) // 命中的图层 ID
console.log(result.lngLat) // 命中的经纬高
```

`PickKind` 取值：

| 值 | 说明 |
| --- | --- |
| `graphic` | 命中图形。 |
| `layer` | 命中图层。 |
| `tiles-feature` | 命中 3D Tiles 要素。 |
| `terrain` | 命中地形（无对象）。 |
| `native` | 命中未分类的原生对象。 |
| `empty` | 未命中。 |

## 拾取图形或图层

```ts
const graphic = app.interaction.pickGraphic({ x: 400, y: 300 })
const layer = app.interaction.pickLayer({ x: 400, y: 300 })
```

两者分别返回 `{ id }` 或 `undefined`。

## 返回结构

`pick()` 返回 `InteractionPickEvent`，在通用拾取结果上增加 `graphic` 与 `layer`：

```ts
interface InteractionPickEvent {
  kind?: PickKind
  windowPosition: { x: number; y: number }
  graphicId?: string
  layerId?: string
  lngLat?: LngLatHeight
  graphic?: { id: string }
  layer?: { id: string }
  native?: unknown
}
```

## 屏幕坐标

`windowPosition` 为 CSS 像素，相对画布左上角，与鼠标事件坐标一致：

```ts
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect()
  const hit = app.interaction.pick({ x: e.clientX - rect.left, y: e.clientY - rect.top })
})
```

更常见的做法是直接监听交互事件，见[选择与悬停](/interaction/selection)。
