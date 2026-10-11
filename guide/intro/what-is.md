# 什么是 Arc3DLab SDK

Arc3DLab SDK 是一个基于 [CesiumJS](https://cesium.com/platform/cesiumjs/) 的模块化三维 WebGIS 运行时。它把常用的三维地球能力组织成一组稳定的**能力域**，用一个统一的运行时门面（`Arc3DApp`）暴露给应用，减少直接拼接 Cesium 原生对象的工作量。

## 它能做什么

- **场景与相机**：创建地球、切换投影模式、飞行定位、保存与恢复视角。
- **影像与地形**：设置底图、叠加影像、接入地形与 3D Tiles。
- **图形**：点、线、面、模型的创建、样式更新与批量操作。
- **交互**：画布点击、悬停、移动，以及统一的拾取与选中状态。
- **空间分析**：测量、地形采样、通视与可视域、空间查询、剖切与土方计算。
- **扩展**：通过插件系统注册材质、命令与自定义能力。

## 设计要点

### 单一运行时入口

应用通过 `Arc3D.create()` 获得一个 `Arc3DApp`。它是一个聚合门面，各能力域挂在只读属性上：

| 属性 | 能力域 |
| --- | --- |
| `app.scene` | 场景、相机、时钟、环境 |
| `app.camera` | 相机快捷方式（等价于 `app.scene.camera`） |
| `app.basemap` / `app.terrain` | 底图与地形 |
| `app.layers` | 影像叠加、3D Tiles 与数据图层 |
| `app.graphics` | 图形 |
| `app.data` | 数据源与影像提供者 |
| `app.interaction` | 拾取、选择与交互事件 |
| `app.analysis` | 测量、地形、可见性、查询、裁剪与体积分析 |
| `app.effects` | 材质与后处理 |
| `app.ui` | 工具提示等界面服务 |
| `app.plugins` | 插件 |
| `app.native` | 原生 Cesium 逃生舱（advanced / unstable） |

### 统一的位置与错误模型

- 位置使用经纬高：`LngLatHeight`（`{ longitude, latitude, height }`），或简写数组 `[lng, lat]` / `[lng, lat, height]`。经度、纬度单位为度，高度为米。
- 错误统一为 `Arc3DError`，携带机器可读的 `code`，便于分支处理。

### Cesium 优先，原生可及

默认引擎为 Cesium。需要访问未封装的能力时，可通过 `app.native.viewer` 取得原生句柄，但它属于 advanced / unstable，不纳入版本兼容承诺。

## 与其他文档的关系

- 本**开发指南**：以任务为主线，讲怎么用。
- **API 文档**（顶栏入口）：自动从源码生成，列出全部符号、签名与参数。
- **Sandcastle**（顶栏入口）：可运行的示例，在浏览器里直接改代码看效果。

下一步：[快速开始](/intro/quick-start)。
