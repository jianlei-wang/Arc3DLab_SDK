# Data 与 Provider

Updated: 2026-10-08

```ts
app.data.createProvider({ type: "wms" | "wmts" | "xyz" | "geojson" | "kml" | "czml" | "tdt" | "ion", ... })
await app.data.addGeoJson({ id, url, renderMode: "auto" })
```

第一阶段支持：

- XYZ / WMS / WMTS / Tianditu / ArcGIS / SingleTile
- GeoJSON / KML / CZML DataSource

后续：MVT / 3D Tiles / I3S / WFS / OGC API Features / COG
