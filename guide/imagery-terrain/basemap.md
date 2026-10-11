# 底图设置

底图通过 `app.basemap` 管理，设置新底图会替换现有底图。

```ts
await app.basemap.set({ type: "xyz", url: "https://tile.example.com/{z}/{x}/{y}.png" })
```

## 读取当前底图

```ts
const layer = app.basemap.get()
console.log(layer?.id, layer?.visible)
```

## 支持的数据源类型

`BasemapSpec` 等同于影像提供者规格 `ProviderSpec`。

| `type` | 关键字段 | 说明 |
| --- | --- | --- |
| `xyz` | `urlTemplate` 或 `url` | 通用 XYZ 瓦片。 |
| `tms` | `url` | Tile Map Service。 |
| `wms` | `url`、`layers`、`parameters` | Web Map Service。 |
| `wmts` | `url`、`layers`、`style`、`format`、`tileMatrixSetID` | Web Map Tile Service。 |
| `tdt` | `mode`（`img`/`vec`/`cva`/`cia`） | 天地图，token 取自 `tokens.tdt` 或 `spec.token`。 |
| `arcgis` | `url` | ArcGIS MapServer。 |
| `ion` | `assetId` | Cesium Ion 影像。 |
| `single` | `url` | 单张图片。 |

## 常见示例

天地图影像：

```ts
await app.basemap.set({ type: "tdt", mode: "img" })
```

ArcGIS：

```ts
await app.basemap.set({
  type: "arcgis",
  url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
})
```

WMS：

```ts
await app.basemap.set({
  type: "wms",
  url: "https://example.com/geoserver/wms",
  layers: "workspace:layer",
  parameters: { transparent: true },
})
```

## 版权署名

通过 `credit` 提供署名文本，会显示在 Credits 区域：

```ts
await app.basemap.set({ type: "xyz", url: "...", credit: "© Example" })
```

相关：[影像图层](/imagery-terrain/imagery)。
