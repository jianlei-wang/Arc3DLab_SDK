# 模型

通过 `app.graphics.addModel()` 放置 glTF / glb 模型。

```ts
const model = app.graphics.addModel({
  url: "https://example.com/models/windmill.glb",
  position: { longitude: 116.391, latitude: 39.907, height: 0 },
  scale: 1,
  minimumPixelSize: 64,
  heading: 45,
})
```

## 选项 `ModelCreateOptions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 模型 ID，未提供时自动生成。 |
| `url` | `string` | 模型资源地址（必填）。 |
| `position` | `PositionInput` | 放置位置。 |
| `scale` | `number` | 缩放系数，默认 `1`。 |
| `minimumPixelSize` | `number` | 最小像素尺寸，默认 `64`。 |
| `heading` | `number` | 绕朝向角度（度），默认 `0`。 |
| `pitch` | `number` | 俯仰角度（度），默认 `0`。 |
| `roll` | `number` | 翻滚角度（度），默认 `0`。 |
| `properties` | `Record<string, unknown>` | 附加属性。 |

## 移动与移除

```ts
model.setPositions({ longitude: 116.4, latitude: 39.91, height: 0 })
model.remove()
```

## 提示

- 未提供 `url` 会抛出 `INVALID_ARGUMENT`。
- 大数据量模型场景建议使用 [3D Tiles](/layers/tileset) 承载，而不是逐个 `addModel()`。

相关：[样式与批量更新](/graphics/style)。
