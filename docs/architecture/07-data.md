# Data 与 Provider

Updated: 2026-10-16

```ts
const provider = await app.data.createProvider({
  type: "xyz" | "wms" | "wmts" | "tdt" | "arcgis" | "ion" | "single" | "tms",
  urlTemplate,
  token,
  credit
})

await app.layers.imagery.add({ type: "xyz", urlTemplate, credit })

const source = await app.data.load({ id: "roads", type: "geojson", url })
await app.data.addGeoJson({ id, url })
await app.data.addKml({ id, url })
await app.data.addCzml({ id, url })
```

`createProvider` 产出栅格 Provider 句柄（`native` 为引擎对象）。`load` / `addGeoJson` 产出 DataSource 资源。

## 数据语义与目录（Partial）

`app.data.load` 在 `Arc3DContext.catalog` 同时登记：

- `DataAsset`：`id / format / uri / version / extent / timeRange / spatialReference / verticalReference / schema / copyright / checksum / source`。
- `LayerMetadata`：`kind: "data"`，`loadState` 在加载过程由 `loading → ready`，失败进入 `failed` 并写入 `error`。

`FeatureSchema / AttributeField` 描述字段模式（`type / unit / enum / required / displayName / derived`）。`FeatureRef` 用 `assetId + featureId + version` 稳定引用业务对象；删除图层不清除资产。

数据源句柄（`app.data.load` 的返回值）销毁时同时注销 `LayerMetadata` 与 `DataAsset`，不残留悬挂资产；注册表登记阶段失败时同样回滚两者。加载失败时图层进入 `failed` 并保留资产，作为一致的失败记录。

```ts
context.catalog.getAsset("roads")
context.catalog.getSchema("roads-schema")
context.catalog.resolveFeature({ featureId: "r1", assetId: "roads" })
```

第一阶段支持：

- XYZ / WMS / WMTS / Tianditu / ArcGIS / SingleTile
- TMS / Cesium Ion 影像
- GeoJSON / KML / CZML DataSource

后续：MVT / I3S / WFS / OGC API Features / COG
