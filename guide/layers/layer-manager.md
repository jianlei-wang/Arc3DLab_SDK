# 图层管理

`app.layers` 聚合了三类图层能力：

| 属性 | 说明 | 详见 |
| --- | --- | --- |
| `app.layers.imagery` | 影像叠加图层 | [影像图层](/imagery-terrain/imagery) |
| `app.layers.tilesets` | 3D Tiles 瓦片集 | [3D Tiles](/layers/tileset) |
| `app.layers.data` | GeoJSON / KML / CZML 数据源 | [数据源与提供者](/data/providers) |

`app.data` 是 `app.layers.data` 的快捷方式。

## 图层句柄

各 `add()` 方法返回一个图层句柄 `Layer`（继承自 `ResourceHandle`）：

```ts
const layer = await app.layers.imagery.add({ type: "xyz", url: "..." })

console.log(layer.id) // 资源 ID
console.log(layer.type) // "imagery"
console.log(layer.visible) // 是否可见

layer.visible = false // 直接切换可见性
layer.destroy() // 移除并释放资源
```

`Layer` 在通用句柄上增加了可选的 `name`、`zIndex` 与 `group`。

## 数据目录

每个图层在注册时也会写入数据目录（`app.context.catalog`），用于统一查询与元数据管理，见[数据目录](/data/catalog)。

## 事件

图层的增删会广播事件：

```ts
app.on("layerAdded", ({ id, type }) => console.log("added", type, id))
app.on("layerRemoved", ({ id, type }) => console.log("removed", type, id))
```

相关：[3D Tiles](/layers/tileset)。
