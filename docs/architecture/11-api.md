# 公共 API

Updated: 2026-10-09

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
- `PickResult` / `Arc3DPlugin` / `NativeContext`
- `Arc3DError` / `createId`

## 就绪语义

`await Arc3D.create()` 解析时表示 Runtime facade 就绪（Manager 已接线、生命周期进入 `ready`）。底图、地形、数据等异步资源有独立状态，可能在 `ready` 之后才完成加载。默认底图成功 / 失败 / 关闭是三条确定路径；`whenSceneReady()` 作为后续增强（Planned）。

## 公共类型白名单

对外承诺类型通过根入口与 `@arc3dlab/sdk` 命名导出；禁止消费者深路径导入 `packages/*/src`。`app.native.viewer` 为 advanced / unstable 逃生舱，随 Cesium 版本变化，不纳入 SemVer 保证。

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
