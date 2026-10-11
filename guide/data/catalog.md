# 数据目录

`DataCatalog` 用统一的方式描述"数据资产"与"图层元数据"，与具体渲染视图解耦。它位于 `app.context.catalog`。

```ts
const catalog = app.context.catalog
```

## 资产（Asset）

注册一个数据资产：

```ts
catalog.registerAsset({
  id: "parcels",
  format: "geojson",
  uri: "https://example.com/parcels.geojson",
  extent: [116.3, 39.8, 116.5, 40.0],
})
```

查询：

```ts
catalog.getAsset("parcels")
catalog.hasAsset("parcels")
catalog.listAssets()
```

`DataAsset` 关键字段：`id`、`format`、`uri`、`version`、`extent`、`timeRange`、`schema` 等。

## 图层元数据

图层在添加时自动注册元数据，也可以手动维护：

```ts
catalog.registerLayer({
  id: "parcels",
  kind: "data",
  assetId: "parcels",
  visible: true,
  loadState: "loading",
})

catalog.updateLayer("parcels", { loadState: "ready" })
```

| 字段 | 说明 |
| --- | --- |
| `kind` | 图层种类：`basemap` / `imagery` / `tileset` / `vector` / `data`。 |
| `assetId` | 关联的数据资产 ID。 |
| `visible` | 是否可见。 |
| `loadState` | `idle` / `loading` / `ready` / `failed` / `unloaded`。 |
| `error` | 失败时的错误信息。 |

## 稳定要素引用

跨版本引用要素时使用 `FeatureRef(assetId, featureId, version?)`，避免依赖易变的渲染 ID：

```ts
catalog.resolveFeature({ assetId: "parcels", featureId: "42" })
```

相关：[数据源与提供者](/data/providers)。
