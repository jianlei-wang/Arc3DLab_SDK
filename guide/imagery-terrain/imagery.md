# 影像图层

底图用于替换，影像叠加用于在底图之上叠加更多图层。

## 添加

`app.layers.imagery.add()` 接受底图同样的 `ProviderSpec`，并额外支持自定义 `id` 与 `name`：

```ts
const grid = await app.layers.imagery.add({
  id: "roads",
  name: "路网",
  type: "xyz",
  urlTemplate: "https://tile.example.com/roads/{z}/{x}/{y}.png",
})
```

未提供 `id` 时会自动生成。

## 显示与隐藏

```ts
app.layers.imagery.show("roads", false)
app.layers.imagery.show("roads", true)
```

## 移除

```ts
app.layers.imagery.remove("roads")
```

`show()` 与 `remove()` 在图层存在且类型为 `imagery` 时返回 `true`。

## 与底图的区别

| | 底图 `app.basemap` | 影像 `app.layers.imagery` |
| --- | --- | --- |
| 数量 | 单个，设置即替换 | 可叠加多个 |
| 位置 | 自动置底 | 叠加在底图之上 |
| 典型用途 | 基础影像 | 路网、标注、专题图 |

相关：[地形](/imagery-terrain/terrain)。
