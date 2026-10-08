# Internal Packages

这些包是 Arc3DLab 的内部模块边界。第一阶段只发布根包 `arc3dlab`。

| 包 | 职责 | 允许依赖 Cesium |
|---|---|---|
| `@arc3dlab/core` | 运行时、事件、资源、生命周期 | 否 |
| `@arc3dlab/engine-cesium` | Cesium 引擎适配 | 是 |
| `@arc3dlab/scene` | 场景 / 相机 | 是 |
| `@arc3dlab/layers` | 底图 / 地形 / 影像 / Tileset | 是 |
| `@arc3dlab/graphics` | 点线面要素与 RenderPolicy | 是 |
| `@arc3dlab/data` | GeoJSON / KML / CZML | 是 |
| `@arc3dlab/interaction` | 拾取与指针事件 | 是 |
| `@arc3dlab/analysis` | 测量与分析 | 是 |
| `@arc3dlab/effects` | 特效骨架 | 是 |
| `@arc3dlab/ui` | Tooltip / Popup | 是 |
| `@arc3dlab/sdk` | `Arc3D.create` / Arc3DApp | 间接 |
| `@arc3dlab/legacy` | `Viewer` 兼容层 | 间接 |

后续按成熟度再拆成公开 npm 包。
