# 创建应用

应用通过 `Arc3D.create()` 创建，返回一个已接线的 `Arc3DApp`。

```ts
import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({ container: "map" })
```

## 同步创建

在不需要等待的场景（例如兼容旧代码）可以用 `createSync()`，它返回同一类型的实例，但不返回 Promise：

```ts
const app = Arc3D.createSync({ container: "map" })
```

两种方式产出的实例一致；`create()` 只是以 Promise 形式表达"创建完成"。

## 配置项 `Arc3DConfig`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `container` | `string \| Element` | 承载地球的元素或元素 ID（必填）。 |
| `engine.type` | `"cesium"` | 引擎类型，当前仅支持 `cesium`。 |
| `engine.cesium.ionToken` | `string` | Cesium Ion Token。 |
| `engine.cesium.defaultViewRectangle` | `[number, number, number, number]` | 默认视图范围 `[west, south, east, north]`（度）。 |
| `engine.cesium.defaultBaseLayer` | `boolean` | 是否启用默认底图。 |
| `scene.mode` | `"3d" \| "2d" \| "columbus"` | 初始场景模式。 |
| `scene.depthTestAgainstTerrain` | `boolean` | 是否对地形进行深度测试。 |
| `scene.resolutionScale` | `number \| "auto"` | 渲染分辨率缩放。 |
| `scene.controls` | `"default" \| "mapbox"` | 交互控件方案。 |
| `scene.fpsShow` | `boolean` | 是否显示帧率。 |
| `scene.creditMode` | `CreditMode` | Credits 展示模式。 |
| `tokens.cesiumIon` | `string` | Cesium Ion Token（与 `engine.cesium.ionToken` 等价）。 |
| `tokens.tdt` | `string` | 天地图 Token。 |
| `logger.level` | `"debug" \| "info" \| "warn" \| "error" \| "silent"` | 日志级别，默认 `warn`。 |

## 完整示例

```ts
import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({
  container: "map",
  tokens: { cesiumIon: "<your-ion-token>", tdt: "<your-tianditu-token>" },
  engine: {
    cesium: {
      defaultViewRectangle: [70, -15, 140, 80],
      defaultBaseLayer: true,
    },
  },
  scene: {
    mode: "3d",
    controls: "default",
    fpsShow: false,
  },
  logger: { level: "warn" },
})
```

## 访问底层引擎

需要未封装的能力时，可通过 `app.native.viewer` 与 `app.context` 访问底层对象。它们属于 advanced / unstable：

```ts
const viewer = app.native.viewer as import("cesium").Viewer
```

下一步：[就绪语义](/runtime/readiness)。
