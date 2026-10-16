# 从 Viewer 迁移到 Arc3DApp

旧版 `Viewer` / `Map` 及 `@arc3dlab/legacy` 包已在 2.0.0 移除。下文「旧」代码仅用于展示到当前合同的映射，请勿在新项目中引用；完整映射见 `docs/architecture/13-migration.md`。

```ts
// 旧
import { Viewer } from "arc3dlab"
const viewer = new Viewer("map")
viewer.Layers.Add.addPolygons(positions, options)

// 新
import { Arc3D } from "arc3dlab"
const app = await Arc3D.create({ container: "map" })
app.graphics.addPolygon({ positions, style })
```

| 旧 API | 新 API |
|---|---|
| `new Viewer(el)` | `await Arc3D.create({ container: el })` |
| `viewer.Layers.Add.addPoints` | `app.graphics.addPoint` / `addPoints` |
| `viewer.Layers.Add.addLines` | `app.graphics.addPolyline` |
| `viewer.Layers.Add.addPolygons` | `app.graphics.addPolygon` |
| `viewer.Terrain` | `app.terrain` |
| `viewer.EventHandler` | `app.interaction` |
| `viewer.ReminderTip` | `app.ui.tooltip` |
| `viewer.baseImagery` | `app.basemap` |
| `viewer.destroy()` | `await app.destroy()` |
