# 空间查询

空间查询位于 `app.analysis.query`，用于在当前图形集合中按几何关系检索，返回命中的图形。

## 矩形查询

```ts
const { graphics } = await app.analysis.query.rectangle({
  west: 116.3,
  south: 39.8,
  east: 116.5,
  north: 40.0,
  relation: "intersect", // 或 "within"
})

console.log(graphics) // [{ id, type }]
```

## 多边形查询

```ts
const { graphics } = await app.analysis.query.polygon({
  positions: ring,
  relation: "within",
})
```

## 距离查询

查询中心点给定距离内的图形：

```ts
const { graphics } = await app.analysis.query.distance({
  position: [116.391, 39.907],
  meters: 1000,
})
```

## 参数

| 查询 | 参数 |
| --- | --- |
| `rectangle` | `west`、`south`、`east`、`north`、`relation?` |
| `polygon` | `positions`、`relation?` |
| `distance` | `position`、`meters` |

`relation` 取值 `"intersect"`（默认）或 `"within"`。

## 结果

返回 `{ graphics: QueryHit[] }`，`QueryHit` 为 `{ id, type }`。可按 ID 取回图形句柄进一步处理：

```ts
for (const hit of graphics) {
  app.graphics.get(hit.id)?.setStyle({ color: "#f2c94c" })
}
```

相关：[任务契约](/analysis/tasks)。
