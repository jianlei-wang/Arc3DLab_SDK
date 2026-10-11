# UI 提示

`app.ui.tooltip` 提供一个跟随鼠标的提示框，适合配合悬停展示信息。

## 显示与隐藏

```ts
app.ui.tooltip.show("北京")
```

```ts
app.ui.tooltip.hide()
```

## 更新文本

```ts
app.ui.tooltip.text = "上海"
console.log(app.ui.tooltip.text)
```

## 配合悬停

```ts
app.interaction.on("hover", (event) => {
  if (event.graphicId) app.ui.tooltip.show(`图形：${event.graphicId}`)
  else app.ui.tooltip.hide()
})
```

提示框会挂载在 Cesium 容器内，并随鼠标移动自动定位。

## 清理

应用销毁时会一并清理提示框；单独清理可调用：

```ts
app.ui.tooltip.destroy()
```

相关：[选择与悬停](/interaction/selection)。
