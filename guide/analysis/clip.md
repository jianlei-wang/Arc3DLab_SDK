# 剖切与开挖

剖切位于 `app.analysis.clip`，用于按平面、盒范围或多边形裁剪地球。

## 平面剖切

```ts
app.analysis.clip.setPlane({
  origin: [116.391, 39.907],
  heading: 90, // 可选，平面朝向（度）
})
```

## 盒状剖切

```ts
app.analysis.clip.setBox({
  west: 116.3,
  south: 39.8,
  east: 116.5,
  north: 40.0,
})
```

## 多边形剖切

```ts
app.analysis.clip.setPolygon({ positions: ring })
```

## 开挖

以多边形与底面平面构成开挖体，`depth` 为开挖深度（米）：

```ts
const result = app.analysis.clip.setExcavation({
  positions: ring,
  depth: 30,
})

console.log(result.volumetric, result.method)
```

## 查询与清除

```ts
app.analysis.clip.list() // 当前生效的裁剪类型
app.analysis.clip.clear() // 清除全部裁剪
```

## 与土方计算的配合

开挖体可以配合土方计算得到挖填量，见[土方计算](/analysis/volume)。

相关：[任务契约](/analysis/tasks)。
