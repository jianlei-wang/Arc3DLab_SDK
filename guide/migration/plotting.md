# 军事标绘

`app.plotting` 提供 24 类军事态势标绘，按锚点生成点、线、面图元并落地为场景实体。

## 绘制

调用 `draw(symbol, options)` 并传入符号类型与锚点：

```ts
const arrow = app.plotting.draw("attackArrow", {
  positions: [
    { longitude: 116.39, latitude: 39.9 },
    { longitude: 116.42, latitude: 39.92 },
    { longitude: 116.4, latitude: 39.94 },
  ],
  style: { color: "#ff3300", fillColor: "#ff330066", width: 2 },
})
```

返回 `PlotResult`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 结果标识。 |
| `symbol` | `PlotSymbol` | 使用的符号类型。 |
| `positions` | `LngLat[]` | 原始锚点。 |
| `shapes` | `PlotShape[]` | 计算得到的图元集合。 |
| `entities` | `unknown[]` | 已创建的底层实体。 |

## 符号分类

`PLOT_SYMBOLS` 汇总全部符号，并按类别导出：`PLOT_POINT_SYMBOLS`、`PLOT_LINE_SYMBOLS`、`PLOT_POLYGON_SYMBOLS`、`PLOT_ARROW_SYMBOLS`。常用符号包括 `attackArrow`、`lineArrow`、`straightArrow`、`pincerArrow`、`circle`、`ellipse`、`sector`、`regularPolygon`、`flag`、`formation`、`label` 等。

## 样式与选项

`PlotDrawOptions` 继承 `PlotSymbolOptions`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `positions` | `LngLat[]` | 锚点集合，必填。 |
| `style` | `PlotStyle` | 线色、填充色、线宽等。 |
| `clampToGround` | `boolean` | 是否贴合地表，默认 `true`。 |
| `sides` | `number` | 正多边形边数，仅 `regularPolygon`。 |
| `flagType` | `FlagType` | 旗标样式，仅 `flag`。 |
| `formationType` | `FormationType` | 阵型样式，仅 `formation`。 |
| `labelText` | `string` | 标注文本，仅 `label`。 |
| `image` | `string` | 图片地址，仅 `billboard`。 |
| `id` | `string` | 结果标识，未提供时自动生成。 |

## 管理

```ts
app.plotting.remove(arrow.id)
app.plotting.removeAll()
```

`algorithm` 子模块导出贝塞尔、弓形、箭头、集结地等纯几何算法（`getBezierPoints`、`getQBSplinePoints`、`doubleArrow`、`formationPoints` 等），可在无引擎环境下复用。

相关：[图形与样式](/graphics/style)、[效果与材质](/effects-ui/effects)。
