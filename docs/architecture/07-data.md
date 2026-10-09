# Data 与 Provider

Updated: 2026-10-08

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

第一阶段支持：

- XYZ / WMS / WMTS / Tianditu / ArcGIS / SingleTile
- TMS / Cesium Ion 影像
- GeoJSON / KML / CZML DataSource

后续：MVT / I3S / WFS / OGC API Features / COG
