# 从 Viewer 迁移

旧版 `Viewer` 是 `Arc3DApp` 的兼容适配器，已标记为 deprecated。新代码请直接使用 `Arc3D.create()`。

## 对照表

| 旧版 `Viewer` | 新版 `Arc3DApp` |
| --- | --- |
| `new Viewer(container, options)` | `await Arc3D.create(config)` / `Arc3D.createSync(config)` |
| `viewer.Layers.Add.addPoints(...)` | `app.graphics.addPoints({ positions, style })` |
| `viewer.Layers.Add.addLines(...)` | `app.graphics.addPolyline({ positions, style })` |
| `viewer.Layers.Add.addPolygons(...)` | `app.graphics.addPolygon({ positions, style })` |
| `viewer.Layers.get(id)` | `app.graphics.get(id) ?? app.context.registry.get(id)` |
| `viewer.Layers.remove(id)` | `app.graphics.remove(id)` |
| `viewer.Layers.show(id, visible)` | `app.graphics.show(id, visible)` |
| `viewer.Layers.clear()` | `app.graphics.clear()` |
| `viewer.Terrain` | `app.terrain` |
| `viewer.EventHandler` | `app.interaction` |
| `viewer.ReminderTip` | `app.ui.tooltip` |
| `viewer.native` | `app.native.viewer` |
| `viewer.scene` / `viewer.camera` | `app.native.viewer` 上的对应对象 |
| `viewer.canvas` | `app.context.engine.viewer.canvas` |
| `viewer.destroy()` | `app.destroy()` |

## 迁移前

```ts
import { Viewer } from "arc3dlab"

const viewer = new Viewer("map", { defaultKey: "<ion-token>" })

viewer.Layers.Add.addPoints([[116.391, 39.907]], { color: "#ff3b30" })
viewer.ReminderTip.show("提示")
```

## 迁移后

```ts
import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({
  container: "map",
  tokens: { cesiumIon: "<ion-token>" },
})

app.graphics.addPoints({
  positions: [[116.391, 39.907]],
  style: { color: "#ff3b30" },
})
app.ui.tooltip.show("提示")
```

## 配置映射

| 旧版选项 | 新版配置 |
| --- | --- |
| `defaultKey` | `tokens.cesiumIon` |
| `fpsShow` | `scene.fpsShow` |
| `mapboxController` | `scene.controls: "mapbox"` |

旧版 `Viewer` 仍可继续使用，但不再新增能力；建议逐步迁移到 `Arc3DApp`。
