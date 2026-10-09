# 公共 API

Updated: 2026-10-08

## 稳定入口

```ts
import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({
  container: "map",
  engine: { type: "cesium", cesium: { ionToken: runtimeToken } }
})
```

稳定导出：

- `Arc3D` / `Arc3DApp`
- `Graphic` / `Layer`
- `LngLat` / `LngLatHeight` / `CameraPose`
- `PickResult` / `Arc3DPlugin` / `Arc3DError`

P2 能力入口：

- `app.graphics.addModel`
- `app.data.createProvider` / `app.data.load`
- `app.interaction.selection` / `pickGraphic` / `pickLayer` / `hover`
- `app.analysis.measure.height` / `heading` / `horizontalDistance`
- `app.effects.materials`
- `app.analysis.terrain.sampleHeight` / `slope` / `profile`
- `app.analysis.visibility.lineOfSight` / `viewshed`（`draw` / `rangeMeters`）
- `app.effects.postprocess`
- `app.analysis.query.rectangle` / `polygon` / `distance`
- `app.analysis.clip.setPlane` / `setBox` / `setPolygon`
- `app.analysis.terrain.setExaggeration`
- `app.analysis.volume.cutFill` / `excavate`

高级入口：

```ts
import { CesiumEngine } from "arc3dlab/engine-cesium"
```

根入口不再导出全部 Cesium 类。需要 Cesium 类型时从 `cesium` 导入。

## 兼容入口

```ts
import { Viewer } from "arc3dlab"
const viewer = new Viewer("map")
viewer.app // Arc3DApp
```

`Viewer` 是 Legacy Adapter，文档主路径是 `Arc3D.create()`。
