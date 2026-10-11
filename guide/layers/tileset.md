# 3D Tiles

通过 `app.layers.tilesets.add()` 加载 3D Tiles 瓦片集。

## 从 URL 加载

```ts
const tileset = await app.layers.tilesets.add({
  url: "https://example.com/tileset.json",
})
```

## 从 Cesium Ion 加载

```ts
const tileset = await app.layers.tilesets.add({ assetId: 96188 })
```

Ion token 取自创建应用时的 `tokens.cesiumIon`。

`add()` 选项：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 自定义资源 ID，未提供时自动生成。 |
| `url` | `string` | 瓦片集地址。 |
| `assetId` | `number` | Ion 资源 ID。 |

`url` 与 `assetId` 至少提供一个，否则抛出 `INVALID_ARGUMENT`。

## 可见性与移除

```ts
tileset.visible = false
tileset.destroy()
```

## 定位到瓦片集

加载后通常需要把相机对准它：

```ts
const viewer = app.native.viewer as { flyTo?: (target: unknown) => void }
// 或使用已知坐标定位
await app.camera.flyTo([121.5, 31.23, 500])
```

相关：[图层管理](/layers/layer-manager)、[拾取](/interaction/pick)。
