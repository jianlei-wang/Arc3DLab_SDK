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

## 所有权与无效输入

`clear()` 与 `destroy()` 只清除本服务创建的裁剪，并恢复创建应用前 Globe 上已有的裁剪状态，因此可以与调用方或其它子系统的裁剪共存。

`setPolygon()` / `setExcavation()` 在顶点少于三个时抛出 `INVALID_ARGUMENT`，且不改变当前裁剪与 `list()` 的结果。

## 与土方计算的配合

开挖体可以配合土方计算得到挖填量，见[土方计算](/analysis/volume)。

相关：[任务契约](/analysis/tasks)。
