# Layers 模块

Updated: 2026-10-10

## Layer 模型

```ts
interface Layer {
  id: LayerId
  name?: string
  visible: boolean
  zIndex?: number
  group?: string
  metadata?: Record<string, unknown>
  destroy(): void
}
```

类型：

- BaseLayer / ImageryLayer / TerrainLayer
- TilesetLayer / DataLayer / PrimitiveLayer / ModelLayer / EffectLayer

## 职责边界

- `app.basemap`：当前底图，同时只激活一套 basemap
- `app.terrain`：地形 provider 与夸张、透明度、碰撞
- `app.layers.imagery`：叠加影像
- `app.layers.tilesets`：3D Tiles
- `app.layers.data`：矢量数据图层

Graphic 走 `app.graphics`，不再挂在 Layers 下。

## LayerMetadata 与数据目录

每个图层在 `Arc3DContext.catalog` 登记一条 `LayerMetadata`（`kind / visible / loadState / zIndex / group / error / spatialReference`）。`loadState` 取值 `idle / loading / ready / failed / unloaded`。图层销毁时只移除对应 metadata，引用的 `DataAsset` 保留，同一数据可被多个视图复用。

```ts
const context = app.context
context.catalog.listLayers()      // LayerMetadata[]
context.catalog.getLayer(id)
context.catalog.listAssets()      // DataAsset[]
```

## Basemap

```ts
await app.basemap.set({
  type: "xyz" | "wms" | "wmts" | "tdt" | "arcgis" | "ion" | "single",
  urlTemplate?: string
  token?: string
  credit?: string
})
```

天地图 token 由调用方传入。底图切换先移除当前 owned basemap，再添加新图层。
