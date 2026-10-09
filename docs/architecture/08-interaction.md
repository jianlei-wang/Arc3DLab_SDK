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

事件：`click` / `hover` / `move`。

```ts
app.interaction.pick(windowPosition)
app.interaction.pickGraphic(windowPosition)
app.interaction.pickLayer(windowPosition)

app.interaction.selection.set(graphicId)
app.interaction.selection.get()
app.interaction.selection.clear()
```

拾取结果同时带 `graphic` 与 `layer`。Polygon Primitive 的 fill/outline 内部 ID 映射回同一个 Graphic。

左键点击到 Graphic 时写入 selection；点到空白处清空 selection。

销毁时必须调用 Cesium `ScreenSpaceEventHandler.destroy()`，并移除全部 input action。
