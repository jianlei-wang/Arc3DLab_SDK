# Scene 模块

Updated: 2026-10-16

Scene 只负责场景状态，不负责业务数据。

## 组成

- `SceneController`：模式、深度检测、截图、尺寸
- `CameraController`：flyTo / setView / lookAt / reset / capture / restore
- `RenderController`：resolutionScale、requestRenderMode、持续渲染需求
- `ViewportController`：canvas 尺寸
- `ClockController`：multiplier、shouldAnimate
- `EnvironmentController`：光照、阴影、大气

## 按需渲染与动态效果协调

引擎默认开启按需渲染（`requestRenderMode = true`）并设置 `maximumRenderTimeChange = Infinity`，静态场景不再无谓地逐帧绘制。依赖帧编号推进的动画（雨雪、闪电、粒子、动态材质、洪水水面等）会通过 `RenderModeCoordinator` 持有“持续渲染需求”：存在活动需求时临时强制持续渲染，需求全部释放后自动恢复按需渲染。

```ts
const release = app.scene.render.acquireContinuousRender("custom-radar")
// ...动画结束后
release()
```

基础 `RenderModeCoordinator` 见 `packages/engine-cesium/src/render-mode.ts`，跨包使用统一走 `@arc3dlab/core` 的 `acquireContinuousRender(context, reason)` 容错封装。

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

## 多屏联动生命周期

`app.scene.sync(views)` 返回 `SyncViewer`。场景控制器跟踪全部已创建的 `SyncViewer`，`app.scene.destroy()` 或应用销毁时统一 `destroy()`，解除对主视图相机 `changed` 事件的监听，避免监听器泄漏。单对象 `destroy()` 幂等，可提前手动结束联动。
