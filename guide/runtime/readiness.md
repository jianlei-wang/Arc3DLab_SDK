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
  // 首屏瓦片已稳定；底图是否成功显示仍需检查 result.defaultBaseLayer
} else if (result.timedOut) {
  // 超时；瓦片可能仍在加载
}
```

### 返回值 `SceneReadyResult`

| 字段               | 类型                    | 说明                        |
| ------------------ | ----------------------- | --------------------------- |
| `ready`            | `boolean`               | 未超时且未销毁时为 `true`。 |
| `remainingTiles`   | `number`                | 仍在加载的 Globe 瓦片数。   |
| `timedOut`         | `boolean`               | 是否因超时返回。            |
| `destroyed`        | `boolean`               | 等待期间是否被销毁。        |
| `defaultBaseLayer` | `DefaultBaseLayerState` | 默认底图状态。              |

`ready: true` 表示等待条件已满足，默认底图仍可能是 `failed`；以 `defaultBaseLayer` 判断底图是否成功显示。`whenSceneReady()` 可以重复调用：设置业务底图或地形后再次等待，即可覆盖新的首屏资源。

就绪后也会广播 `sceneReady` 事件：

```ts
app.on("sceneReady", (result) => {
  console.log("scene ready, remaining tiles:", result.remainingTiles)
})
```

## 资源就绪对照

不同 API 的 Promise 完成时刻对应不同范围的就绪，按需要等待最靠近业务目标的那一层：

| 资源或操作                              | 调用完成时的状态                         | 进一步等待                                            |
| --------------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| `Arc3D.create()`                        | 运行时门面与各管理器可用                 | 底图、地形、数据仍可能加载中                          |
| 默认底图与 Globe 首屏                   | 运行时内部创建                           | `whenSceneReady()`；检查 `defaultBaseLayer`           |
| `basemap.set()`                         | 提供者已挂载并显示                       | 再次 `whenSceneReady()` 等待新底图瓦片                |
| `terrain.set()`                         | 地形提供者已设置                         | 地形瓦片按需加载；采样结果用 `source` / `status` 判断 |
| `layers.data.add()` / `app.data.load()` | 数据源已加载并登记，`loadState: "ready"` | 无需额外等待；失败时抛错并保留 `failed` 记录          |
| `layers.tilesets.add()`                 | 瓦片集已创建并挂载                       | 瓦片按需加载；SDK 不提供全量瓦片完成 Promise          |
| `graphics.add*()`                       | 图形已创建并进入场景                     | 下一帧绘制；截图类 API 自行等待渲染帧                 |
| 分析类 Promise                          | 计算已完成                               | 地形结果检查每点 `source` / `status`                  |

“管理器可用”与“数据已加载”是两件事。把初始定位、截图、量算放在 `whenSceneReady()` 之后，能避免在瓦片或底图尚未稳定时得到空画面或回退高程。

## 什么时候用哪个

- 创建后立刻注册监听、准备 UI：用 `ready`。
- 需要稳定画面（截图、初始飞行、量算）：用 `whenSceneReady()`。

相关：[生命周期与销毁](/runtime/lifecycle)。
