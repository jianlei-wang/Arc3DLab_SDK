# 公共 API

Updated: 2026-10-10

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
- `SceneReadyOptions` / `SceneReadyResult` / `DefaultBaseLayerState`
- `Arc3DError` / `createId`

## 业务语义类型

空间与数据合同从 `@arc3dlab/core` 导出：

- `SpatialReference` / `VerticalReference` / `VerticalDatum` / `TimeRange` / `CoordinateTransform`
- `WGS84` / `WGS84_3D` / `WEB_MERCATOR` / `ELLIPSOID_VERTICAL`
- `resolveSpatialReference` / `resolveVerticalReference` / `assertGeographicPosition` / `tryCreateCoordinateTransform` / `assertTimeRange`
- `DataCatalog` / `DataAsset` / `FeatureSchema` / `AttributeField` / `FeatureRef` / `LayerMetadata` / `LoadState`

统一分析任务合同从 `@arc3dlab/analysis` 导出：

- `runAnalysisTask` / `AnalysisTaskRegistry` / `createTaskExecutor`
- `AnalysisTask` / `AnalysisResult` / `AnalysisExecution` / `ResultArtifact`
- 内置分析任务化方法：`measure.*Task` / `terrain.*Task` / `visibility.*Task` / `query.*Task` / `volume.cutFillTask`，返回 `AnalysisResult` 并登记到 `app.analysis.tasks`

## 就绪语义

`await Arc3D.create()` 解析时表示 Runtime facade 就绪（Manager 已接线、生命周期进入 `ready`）。底图、地形、数据等异步资源有独立状态，可能在 `ready` 之后才完成加载。默认底图成功 / 失败 / 关闭是三条确定路径，由 `app.scene.whenSceneReady()` 统一回报：

```ts
const result = await app.scene.whenSceneReady({ timeoutMs?: number })
result.ready            // 未超时且未销毁
result.remainingTiles   // 仍在加载的 Globe 瓦片数
result.timedOut         // 是否超时返回
result.destroyed        // 等待期间是否被销毁
result.defaultBaseLayer // disabled | loading | ready | failed
```

`whenSceneReady` 等待初始渲染帧与 Globe 瓦片加载完成，就绪后派发 `sceneReady` 事件。

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

## API 文档站

公共 API 文档由自研生成器产出，形式对齐 CesiumJS ref-doc（JSDoc 默认结构类名、侧边栏包命名空间 + 类别分组），覆盖全部 13 个包：

```bash
# 提取类型模型并构建静态站点（输出 api-docs/api/）
npm run docs:build

# 校验公共符号注释覆盖率（summary >= 70%，params >= 50%）
npm run lint:docs

# 本地预览
npm run docs:preview
```

生成流程：`typedoc --json` 提取模型 → `normalize` 归一化为 DocsModel → `render` 输出 HTML。产物写入 `api-docs/`（被 gitignore），覆盖率报告写入 `docs/api/report.json`。`lint:docs` 已纳入 `gate` 与 CI，构建产物作为 `api-docs` artifact 上传。

正文中文，标识符 / 类型 / 签名保持英文；源码链接指向仓库对应提交的 `#L<line>`。`typedoc-material-theme` 与 `typedoc-plugin-markdown` 已移除。
