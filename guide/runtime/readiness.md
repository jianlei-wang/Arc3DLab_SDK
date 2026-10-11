# 就绪语义

"就绪"在 Arc3DLab 里分两层，理解它们的差别可以避免在错误时机做初始定位或截图。

## 运行时就绪

`Arc3D.create()` 解析完成表示 **Runtime facade 就绪**：各能力域已接线，可以调用 API。此时底图、地形、数据可能仍在加载。

同时会广播 `ready` 事件：

```ts
app.on("ready", () => {
  console.log("runtime ready")
})
```

## 首屏就绪

首屏资源（Globe 瓦片）加载到可接受状态后，才算 **场景就绪**。等待它用 `app.scene.whenSceneReady()`：

```ts
const result = await app.scene.whenSceneReady({ timeoutMs: 10000 })

if (result.ready) {
  // 可以安全地进行初始定位或截图
} else if (result.timedOut) {
  // 超时；瓦片可能仍在加载
}
```

### 返回值 `SceneReadyResult`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ready` | `boolean` | 未超时且未销毁时为 `true`。 |
| `remainingTiles` | `number` | 仍在加载的 Globe 瓦片数。 |
| `timedOut` | `boolean` | 是否因超时返回。 |
| `destroyed` | `boolean` | 等待期间是否被销毁。 |
| `defaultBaseLayer` | `DefaultBaseLayerState` | 默认底图状态。 |

就绪后也会广播 `sceneReady` 事件：

```ts
app.on("sceneReady", (result) => {
  console.log("scene ready, remaining tiles:", result.remainingTiles)
})
```

## 什么时候用哪个

- 创建后立刻注册监听、准备 UI：用 `ready`。
- 需要稳定画面（截图、初始飞行、量算）：用 `whenSceneReady()`。

相关：[生命周期与销毁](/runtime/lifecycle)。
