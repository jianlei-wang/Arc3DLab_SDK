# 选择与悬停

## 选中状态

`app.interaction.selection` 维护当前选中资源。

```ts
app.interaction.selection.id // 当前选中 ID 或 undefined
app.interaction.selection.get() // 选中资源句柄
app.interaction.selection.set("point-1") // 设置选中
app.interaction.selection.clear() // 清除选中
```

点击画布时会自动更新选中状态：命中图形则选中该图形，否则清除。

## 点击选中图形

```ts
app.interaction.on("click", (event) => {
  if (event.graphicId) {
    app.graphics.get(event.graphicId)?.setStyle({ color: "#f2c94c" })
  }
})
```

## 悬停高亮

```ts
app.interaction.on("hover", (event) => {
  app.ui.tooltip.show(event.graphicId ? `图形：${event.graphicId}` : "")
})
```

`hover` 事件只在悬停目标发生变化时触发（内部有去重门控），离开画布时会以 `empty` 结果触发一次。

## 鼠标移动

```ts
app.interaction.on("move", ({ windowPosition }) => {
  // windowPosition 为当前屏幕坐标
})
```

## 节流建议

`move` 触发频繁，建议在回调里做节流，或仅更新必要的 DOM。

相关：[拾取](/interaction/pick)、[事件总线](/interaction/events)。
