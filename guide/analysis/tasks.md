# 分析任务契约

分析服务有两种调用形态：

- **直接调用**（如 `measure.distance()`）：返回具体的测量结果，适合简单、即时的计算。
- **任务调用**（如 `measure.distanceTask()`）：返回统一的 `AnalysisResult`，带状态、单位、产物、警告与取消/进度支持，适合长耗时或需要统一处理的场景。

## 任务状态

```ts
type AnalysisTaskStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled"
```

- 执行过程中抛出错误会转为 `status: "failed"`。
- 通过 `signal` 取消会转为 `status: "cancelled"`。

## 处理任务结果

```ts
const result = await app.analysis.measure.areaTask({ positions: ring })

switch (result.status) {
  case "succeeded":
    console.log(result.value?.squareMeters, result.units)
    break
  case "cancelled":
    console.log("已取消")
    break
  case "failed":
    console.error(result.error)
    break
}
```

`AnalysisResult` 关键字段：

| 字段 | 说明 |
| --- | --- |
| `taskId` / `algorithm` / `algorithmVersion` | 任务标识与算法版本。 |
| `status` | 任务状态。 |
| `value` | 结果值。 |
| `units` | 结果单位。 |
| `spatialReference` / `verticalReference` | 空间与垂直参考。 |
| `warnings` | 警告列表。 |
| `artifacts` | 附加产物列表。 |
| `error` | 失败信息。 |

## 取消与进度

```ts
const controller = new AbortController()

app.analysis.terrain.profileTask({
  positions: line,
  samples: 128,
  signal: controller.signal,
  onProgress: (p) => console.log(p),
})

// 之后可取消
controller.abort()
```

## 自定义任务

`app.analysis.run()` 以同一契约运行自定义分析：

```ts
await app.analysis.run({
  algorithm: "custom.myAlgorithm",
  input: { /* ... */ },
  execute: async (runner) => {
    runner.throwIfCancelled("my algorithm")
    return { value: 42, units: {} }
  },
})
```

相关：[测量](/analysis/measure)。
