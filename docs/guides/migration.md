# 从 Viewer 迁移到 Arc3DApp

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
