# Interaction 模块

Updated: 2026-10-08

Interaction 与底层 EventBus 分离：

- EventBus：SDK 内部领域事件
- Interaction：指针、拾取、悬停、选择

```ts
app.interaction.on("click", (event) => {
  event.graphic
  event.layer
  event.lngLat
  event.windowPosition
})
```

销毁时必须调用 Cesium `ScreenSpaceEventHandler.destroy()`，并移除全部 input action。
