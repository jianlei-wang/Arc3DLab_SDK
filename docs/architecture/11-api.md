# 公共 API

Updated: 2026-10-18

## 稳定入口

```ts
import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({
  container: "map",
  engine: { type: "cesium", cesium: { ionToken: runtimeToken } },
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
- `resolveSpatialReference` / `resolveVerticalReference` / `assertGeographicPosition` / `tryCreateCoordinateTransform` / `createCoordinateTransform` / `assertTimeRange`
- `sameHorizontalReference` / `sameVerticalReference` / `sameSpatialReference`：等价性分层判断，`sameSpatialReference` 纳入高程长度单位；`createCoordinateTransform` 仅在同参考下返回恒等转换，其余抛 `UNSUPPORTED_CAPABILITY`
- `DataCatalog` / `DataAsset` / `FeatureSchema` / `AttributeField` / `FeatureRef` / `LayerMetadata` / `LoadState`

`DataCatalog` schema 生命周期：`registerSchema()` / `hasSchema()` / `unregisterSchema()`；资产携带的 schema 随 `unregisterAsset()` 一并移除，被存活资产拥有的 schema 拒绝独立注销。

注册表读取默认返回防御性快照（`CommandBus.get()`、`CapabilityRegistry.get()/records()` 等），修改读取结果不影响内部状态；能力可用性只能经 `CapabilityRegistry.updateAvailability()` 修改。

统一分析任务合同从 `@arc3dlab/analysis` 导出：

- `runAnalysisTask` / `AnalysisTaskRegistry` / `createTaskExecutor`
- `AnalysisJobHost` / `executeAnalysisJob`，以及 `AnalysisJob` / `AnalysisJobResult` / `AnalysisJobHostOptions` / `AnalysisWorkerFactory` / `AnalysisWorkerLike`
- `AnalysisTask` / `AnalysisResult` / `AnalysisExecution` / `ResultArtifact`
- 内置分析任务化方法：`measure.*Task` / `terrain.*Task` / `visibility.*Task` / `query.*Task` / `volume.cutFillTask`，返回 `AnalysisResult` 并登记到 `app.analysis.tasks`

`app.analysis` 的纯数值方法与任务变体共享由 `AnalysisManager` 持有的作业宿主：支持 `Worker` 时在独立线程执行，否则进程内降级；每个在途作业独占一个 Worker 槽位，单项 `signal` 取消只影响该作业；`app.destroy()` 终止全部 Worker 并取消未完成作业。`terrain.*`、`visibility.*` 与 `volume.cutFill` 的地形采样仍在主线程执行。

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

`whenSceneReady` 等待初始渲染帧与 Globe 瓦片加载完成，就绪后派发 `sceneReady` 事件。`ready: true` 表示等待条件已完成，默认底图仍可能处于 `failed`；需要底图成功显示时应同时检查 `defaultBaseLayer === "ready"`。设置业务底图或地形后可再次调用 `whenSceneReady()`，等待新的首屏资源。

## 生命周期与所有权合同

公开对象的所有权、幂等与失败重试语义如下：

| 对象                                   | 所有权               | 释放                                             | 重复调用与失败                                                                                                                                    |
| -------------------------------------- | -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Arc3DApp`                             | 调用方               | `await app.destroy()`                            | 幂等，重复调用返回同一 Promise；销毁后调用 API 抛 `APP_DESTROYED`                                                                                 |
| `ResourceHandle`（`Layer` / 数据源等） | 创建它的管理器       | `handle.destroy()`、管理器移除或 `app.destroy()` | `destroy()` 幂等；从注册表移除后再次移除返回 `false`                                                                                              |
| 事件订阅                               | 调用方               | `app.on()` 返回的取消函数                        | 取消幂等；省略 handler 的 `EventBus.off()` 清除该事件全部监听                                                                                     |
| 插件                                   | `PluginManager`      | `app.plugins.uninstall()` 或 `app.destroy()`     | `use()` 串行执行，同名已安装抛 `DUPLICATE_RESOURCE`；安装失败回滚并标记 `failed`，修复原因后可重新安装；重复卸载已移除插件抛 `RESOURCE_NOT_FOUND` |
| `PluginScope`                          | 安装中的插件         | 作用域关闭时执行 `track` / `manage` 登记的回调   | 关闭后 `track` / `register*` 抛 `INVALID_ARGUMENT`；作用域随重新安装重新打开                                                                      |
| 分析任务                               | `app.analysis.tasks` | `tasks.clear()` 或 `app.destroy()`               | 同一 `taskId` 重复登记抛 `DUPLICATE_RESOURCE`；记录保留到显式清理                                                                                 |
| 取消信号                               | 调用方               | 调用方 `AbortController.abort()`                 | 一次 `signal` 对应一次在途操作；取消是终态，重试使用新调用与新控制器                                                                              |
| 数据源失败记录                         | `DataManager`        | 同 ID 重试自动重置，或 `app.destroy()`           | 失败保留 `failed` 图层与资产用于诊断；成功或加载中的同 ID 记录仍抛 `DUPLICATE_RESOURCE`                                                           |

资源释放回调可能抛错：`ResourceRegistry.clear()` 会继续释放其余资源并收集错误；`PluginScopeManager.close()` 返回清理错误数组，由调用方决定记录方式。调用方在释放后应停止使用对应原生对象。

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

## 兼容入口（已移除）

`Viewer` / `Map` Legacy Adapter 与 `@arc3dlab/legacy` 包已在 2.0.0 移除。旧版用法统一迁移到 `Arc3D.create()`，迁移映射见 `docs/architecture/13-migration.md`。

## API 文档站

公共 API 文档由自研生成器产出，形式对齐 CesiumJS ref-doc（JSDoc 默认结构类名、侧边栏包命名空间 + 类别分组），覆盖全部 12 个内部包与顶层入口：

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

## 开发指南站

面向使用者的**开发指南**基于 VitePress 构建（源码位于 `guide/`），与 API 参考、Sandcastle 互补：

```bash
# 本地开发预览（端口 5175）
npm run guide:dev

# 构建静态产物（输出 guide/.vitepress/dist/）
npm run guide:build

# 预览构建产物（端口 5175）
npm run guide:preview
```

顶栏通过自定义主题（`guide/.vitepress/theme/PeerLinks.vue`）在运行时时计算兄弟端口，与 Sandcastle（5173）、API 文档（5174）互链；在线预览环境下按 `<port>-<suffix>.monkeycode-ai.online` 规则改写。内容按类别分组（简介、运行时、相机、场景、影像地形、图层、图形、交互、分析、特效 UI、扩展与迁移），代码示例与实际公共 API 保持一致。CI 新增 `guide` job 构建并上传 `guide-dist` 构件。
