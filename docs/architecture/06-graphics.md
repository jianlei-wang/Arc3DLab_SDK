# Graphics 模块

Updated: 2026-10-08

## 领域对象

用户描述要素，SDK 选择渲染后端。

```ts
const polygon = app.graphics.addPolygon({
  id: "building-001",
  positions,
  style: { fill: "#2F80ED88", outline: true, outlineColor: "#FFFFFF", outlineWidth: 2 },
  renderMode: "auto"
})
```

`renderMode`: `"auto" | "entity" | "primitive" | "buffer"`

默认 `auto`：

- 少量、可编辑 -> Entity
- 静态批量面/点 -> Primitive
- 超大规模且 Capability 声明支持 -> Buffer（实验能力，需显式开启）

## 内部流水线

```text
GraphicFactory -> RenderPolicy -> EntityBackend | PrimitiveBackend | BufferBackend
```

## 复合资源

Polygon Primitive 与 Outline Primitive 使用不同内部 ID，对外共享同一个 Graphic。`graphic.remove()` 同时回收 fill 与 outline。

## 返回值

`addPoint` / `addPolyline` / `addPolygon` 以及批量 API 始终返回 Graphic 或 Graphic[]。

## Model

```ts
const model = app.graphics.addModel({
  id: "aircraft-1",
  url: "/models/Cesium_Air.glb",
  position: [120.16, 30.26, 80],
  scale: 1,
  minimumPixelSize: 64,
  heading: 90
})
```

Model 走 Graphic 生命周期：`remove()` / `destroy()` 回收 Entity。第一阶段渲染后端为 Entity。
