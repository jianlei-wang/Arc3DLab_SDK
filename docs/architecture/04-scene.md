# Scene 模块

Updated: 2026-10-08

Scene 只负责场景状态，不负责业务数据。

## 组成

- `SceneController`：模式、深度检测、截图、尺寸
- `CameraController`：flyTo / setView / lookAt / reset / capture / restore
- `RenderController`：resolutionScale、requestRenderMode
- `ViewportController`：canvas 尺寸
- `ClockController`：multiplier、shouldAnimate
- `EnvironmentController`：光照、阴影、大气

## 相机类型

```ts
interface LngLat { longitude: number; latitude: number }
interface LngLatHeight extends LngLat { height: number }
interface CameraPose {
  position: LngLatHeight
  heading: number
  pitch: number
  roll: number
  unit: "degrees" | "radians"
}
```

默认单位为 `degrees`。

## 二三维模式

```ts
app.scene.setMode("2d" | "columbus" | "3d")
```

模式切换会保存并恢复 CameraSnapshot，避免视角丢失。
