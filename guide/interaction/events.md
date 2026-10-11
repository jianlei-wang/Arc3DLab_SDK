# 事件总线

Arc3DLab 有两类事件：交互层的鼠标事件，与运行时的领域事件。

## 交互事件

来自 `app.interaction`：

```ts
const off = app.interaction.on("click", (event) => {
  console.log("clicked", event.kind, event.graphicId ?? event.layerId)
})

// 取消订阅
off()
```

| 事件 | 负载 |
| --- | --- |
| `click` | `InteractionPickEvent` |
| `hover` | `InteractionPickEvent` |
| `move` | `{ windowPosition }` |

也可以用 `app.interaction.off(event, handler)` 移除，省略 handler 时移除该事件全部监听器。

## 运行时事件

来自 `app.on()`：

| 事件 | 负载 |
| --- | --- |
| `ready` | - |
| `sceneReady` | `SceneReadyResult` |
| `destroy` | - |
| `cameraChanged` | `CameraState` |
| `layerAdded` / `layerRemoved` | `LayerEvent` |
| `graphicAdded` / `graphicRemoved` | `GraphicEvent` |
| `pick` | `PickResult` |
| `error` | `{ message; code? }` |

```ts
app.on("layerAdded", ({ id, type }) => console.log("layer", type, id))
app.on("graphicAdded", ({ id, type }) => console.log("graphic", type, id))
```

## 处理函数抛错的兜底

事件总线会捕获处理函数抛出的错误，并通过 `error` 事件上报。建议始终订阅一次 `error`：

```ts
app.on("error", ({ message }) => console.warn(message))
```

相关：[选择与悬停](/interaction/selection)、[错误处理](/runtime/errors)。
