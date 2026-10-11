# 渲染模式

场景投影模式由 `app.scene` 管理。

## 读取与切换

```ts
console.log(app.scene.mode) // "3d" | "2d" | "columbus"

app.scene.setMode("2d")
app.scene.setMode("3d")
```

`setMode()` 会以动画完成形变，并在形变结束后自动恢复原相机视角。

## 画布尺寸与截图

```ts
const { width, height } = app.scene.size

const dataUrl = app.scene.captureImage() // PNG Data URL
```

`captureImage()` 会先渲染一帧再导出，适合生成缩略图。通常在 `whenSceneReady()` 之后调用。

## 地形深度测试

开启后，图形会被地形正确遮挡：

```ts
app.scene.setDepthTestAgainstTerrain(true)
```

## 光照

```ts
app.scene.setLighting(true)
```

相关：[时钟与环境](/scene/environment)、[性能监控](/scene/performance)。
