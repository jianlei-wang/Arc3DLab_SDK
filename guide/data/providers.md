# 数据源与提供者

`app.data`（即 `app.layers.data`）负责加载矢量数据源与创建影像提供者。

## 加载数据源

支持 GeoJSON、KML、CZML：

```ts
const layer = await app.data.add({ type: "geojson", url: "https://example.com/a.geojson" })
```

`load()` 是 `add()` 的别名：

```ts
await app.data.load({ type: "kml", url: "https://example.com/a.kml" })
```

针对各格式的快捷方法：

```ts
await app.data.addGeoJson({ url: "..." })
await app.data.addKml({ url: "..." })
await app.data.addCzml({ url: "..." })
```

`DataSourceSpec`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 可选资源 ID。 |
| `type` | `"geojson" \| "kml" \| "czml"` | 数据源格式。 |
| `url` | `string` | 数据源地址。 |

加载失败时会把目录中的图层状态置为 `failed` 并抛出分类后的 `Arc3DError`。

## 创建影像提供者

```ts
const provider = await app.data.createProvider({
  type: "wmts",
  url: "https://example.com/wmts",
  layers: "layer",
})
```

返回 `ProviderHandle`，包含 `id`、`type`、`native` 与原始 `spec`。

## 动态数据与时钟

CZML 常含时间动态。加载后可开启时钟：

```ts
app.scene.clock.shouldAnimate = true
app.scene.clock.multiplier = 60
```

相关：[数据目录](/data/catalog)、[时钟与环境](/scene/environment)。
