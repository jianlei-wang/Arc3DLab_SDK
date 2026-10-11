# 性能监控

## 帧率显示

```ts
app.performance.fpsVisible // 当前是否显示
app.performance.setFpsVisible(true)
```

也可以从场景侧设置（等价）：

```ts
app.scene.setFpsVisible(true)
```

## 诊断快照

```ts
const diag = app.getDiagnostics()
```

返回运行时诊断信息，包含后处理阶段数量与已安装插件名等，便于排查性能与配置问题。

## 分辨率缩放

在创建应用时通过配置降低渲染分辨率，可在低端设备上提升帧率：

```ts
const app = await Arc3D.create({
  container: "map",
  scene: { resolutionScale: 0.75 }, // 或 "auto"
})
```

## 建议

- 需要批量创建图形时，优先使用 `addPoints()` / `addPolylines()` / `addPolygons()`，让运行时统一选择渲染模式。
- 高频更新坐标时，使用图形的 `setPositions()` 或 `app.graphics.updatePositionsBatch()`，避免反复创建与销毁。

相关：[样式与批量更新](/graphics/style)。
