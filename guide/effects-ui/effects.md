# 材质与后处理

效果能力位于 `app.effects`：`materials` 管理材质工厂，`postprocess` 管理画面后处理。

## 后处理

```ts
app.effects.postprocess.setBloom(true, { sigma: 2.5 })
app.effects.postprocess.setOutline(true)
app.effects.postprocess.setDepthOfField(true, { focalDistance: 1000 })
app.effects.postprocess.setFog(true, { density: 0.0002 })
app.effects.postprocess.setColorCorrection(true, { brightness: 1.2 })
```

| 方法 | 参数 |
| --- | --- |
| `setBloom(enabled, options?)` | `sigma?`、`delta?`、`stepSize?` |
| `setOutline(enabled)` | - |
| `setDepthOfField(enabled, options?)` | `focalDistance?` |
| `setFog(enabled, options?)` | `density?` |
| `setColorCorrection(enabled, options?)` | `brightness?` |

列出与清除：

```ts
app.effects.postprocess.list() // 激活的效果名
app.effects.postprocess.clear()
```

## 材质

材质注册表默认注册了 `color` 类型。注册自定义材质工厂：

```ts
app.effects.materials.register("stripe", (options) => {
  return { /* 自定义材质实例 */ }
})

const material = app.effects.materials.create("stripe", { gap: 8 })
```

```ts
app.effects.materials.has("stripe")
app.effects.materials.list()
app.effects.materials.unregister("stripe")
```

插件注册的材质会随插件卸载自动清理，见[插件系统](/plugins/plugins)。

## 诊断

`app.getDiagnostics().postprocess` 返回当前激活的后处理数量。

相关：[UI 提示](/effects-ui/tooltip)。
