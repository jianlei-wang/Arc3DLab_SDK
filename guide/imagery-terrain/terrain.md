# 地形

地形通过 `app.terrain` 管理。

## 设置地形

```ts
await app.terrain.set({ type: "ion", assetId: 1 })
```

或使用远程地形服务：

```ts
await app.terrain.set({ type: "url", url: "https://example.com/terrain" })
```

移除地形：

```ts
await app.terrain.set({ type: "none" })
```

`TerrainSpec` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `"url" \| "ion" \| "none"` | 地形类型。 |
| `url` | `string` | 远程地址，`type` 为 `url` 时使用。 |
| `assetId` | `number` | Ion 资源 ID，`type` 为 `ion` 时使用。 |

## 高程夸张

```ts
app.terrain.exaggeration = 2 // 放大 2 倍
```

## 透明度与地下视图

```ts
app.terrain.alpha = 0.6 // 地形透明度
app.terrain.translucency = true // 允许半透明
app.terrain.enableUnderground = true // 允许看到地下
```

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `exaggeration` | `number` | 高程夸张系数。 |
| `alpha` | `number` | 地形透明度。 |
| `translucency` | `boolean` | 是否允许半透明。 |
| `enableUnderground` | `boolean` | 是否允许地下视图。 |

## 地形分析与采样

设置地形后，可以进行剖面、坡度、高程采样等分析，见[地形分析](/analysis/terrain)。

相关：[底图设置](/imagery-terrain/basemap)。
