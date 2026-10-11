# 视角与状态

除了飞行动画，还可以直接读写相机的位姿。

## 设置位姿 `setView`

`setView()` 立即切换到指定位姿，包含位置与朝向：

```ts
app.camera.setView({
  position: { longitude: 116.391, latitude: 39.907, height: 3000 },
  heading: 0,
  pitch: -35,
  roll: 0,
  unit: "degrees",
})
```

`CameraPose` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `position` | `LngLatHeight` | 相机位置。 |
| `heading` | `number` | 航向角。 |
| `pitch` | `number` | 俯仰角。 |
| `roll` | `number` | 翻滚角。 |
| `unit` | `"degrees" \| "radians"` | 角度单位。 |

## 读取状态 `getState`

```ts
const state = app.camera.getState()
console.log(state.position, state.heading, state.pitch)
```

返回值是 `CameraState`（在 `CameraPose` 基础上增加 `capturedAt` 时间戳）。

## 保存与恢复视角

```ts
const snapshot = app.camera.capture() // 捕获当前视角
// ... 用户自由浏览 ...
app.camera.restore(snapshot) // 恢复到捕获时的视角
```

- `capture()` 首次调用时也会把该视角记录为 home。
- `restore()` 未传快照时恢复到 home 或当前状态。

## 设置状态 `setState`

`setState()` 与 `setView()` 等价，接受一个 `CameraPose`：

```ts
app.camera.setState(snapshot)
```

相关：[渲染模式](/scene/mode)。
