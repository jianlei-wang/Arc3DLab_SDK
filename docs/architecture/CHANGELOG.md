# 设计迭代日志

## 2026-10-10

- 落地通用业务语义层（P1-05 / P1-06 / P1-07 / D-01 / D-02 / D-03）：
  - 空间语义：`SpatialReference / VerticalDatum / VerticalReference / TimeRange / CoordinateTransform`；`LngLat` 简写明确为 WGS84、度、椭球高；投影坐标经 `assertGeographicPosition` 拒绝而非静默按经纬度解释。
  - 数据语义：`DataCatalog / DataAsset / FeatureSchema / AttributeField / FeatureRef / LayerMetadata`；`DataManager` 与影像/3D Tiles/底图登记目录，图层销毁不清除领域数据。
  - 分析合同：`runAnalysisTask / AnalysisTaskRegistry / AnalysisTask / AnalysisResult / ResultArtifact`，统一状态、进度、取消、计时、错误与产物；`AnalysisManager.run()` 与 `AnalysisManager.tasks`。
  - 插件扩展：新增 `examples/domain-plugins/sample-report-plugin.ts`，仅用公共合同扩展，验证无需修改 `core`。
- 文档同步 `05-layers`、`07-data`、`09-analysis`、`11-api`。
- 测试新增 spatial-reference、data-catalog、analysis-task、plugin-example，共 16 例。

## 2026-10-09

- 重写整体设计框架 `design.md`：明确 Cesium-first 定位、依赖硬规则、运行时主流程、关键合同、业务语义层、模块清单与质量门禁。
- 建立 `SDK整改与优化清单.md`，跟踪 P0/P1/P2 与业务语义扩展项。
- P0：Engine 保存进 Context 并可注入（`engineAdapter`）；Ion Token 改为串行化作用域；Capability 由 Engine 回报真实可用性并移除空表放行；插件作用域与卸载 `try / finally` 清理。
- P1：ToolRegistry 状态机；Command 参数 Schema（必填/枚举/有限数值/嵌套/额外字段/数组项，错误含字段路径）；插件依赖拆分为 `requiresCapabilities` 与 `dependsOnPlugins`；Bloom 使用真实后处理着色器；`AnalysisWorkerHost` 正名 `AnalysisJobHost`（保留兼容别名）；诊断对象补齐能力/命令/工具/活动工具/插件作用域；领域插件样板迁出产品源码到 `examples/` 与 `tests/fixtures`。
- 文档同步：`02-runtime`、`03-engine`、`10-effects-ui-plugin`、`11-api` 标注实现状态与就绪语义。
- Sandcastle 示例通过 gui 在地球左上角创建按钮、开关和下拉菜单。
- 左侧底部增加运行控制台，捕获示例 console 输出。

## 2026-10-08

- 初始化可迭代设计框架，落盘 00-14 模块文档。
- 确立产品定位：模块化 3D WebGIS Runtime，Cesium 作为首个引擎适配器。
- 确立第一阶段策略：内部 packages 模块化，对外仍发布 `arc3dlab`。
- 主 API 切换为 `Arc3D.create()`，`Viewer` 降为兼容层。
- P0 治理项纳入实现范围：GPL-2.0 许可证一致、Token 运行时注入、Credits 管理、资源生命周期。

## 2026-10-08

- 按最终设计收口源码边界：删除旧 Cesium 封装目录，静态资源迁入 `engine-cesium/assets`。
- Scene 补齐 Render / Viewport / Clock / Environment 控制器。
- LayerManager 暴露 `layers.data`，公共 API 导出 `Graphic` / `Layer`。

## 2026-10-08

- 新增 SDK 开发说明：`docs/guides/sdk-development.md`，覆盖即时测试、预览、API 文档和发布。

## 2026-10-08

- Cesium 固定为 `1.146.0`。
- Sandcastle playground 的 JavaScript 编辑器移到地球左侧。

## 2026-10-08

- 移除 `demo-html`。Playground 由 `demo-vue3` Sandcastle 承担。

## 2026-10-08

- 启动 P2 能力增长：Model Graphic、Data Provider、拾取/选择、基础测量、Material Registry。
- `app.graphics.addModel` 纳入 Graphics 契约。
- `app.data.createProvider` / `load` 成为数据接入入口。
- Interaction 补齐 hover、pickGraphic、pickLayer、selection。
- Analysis 测量补齐 height / heading / horizontalDistance / verticalDistance / spaceAngle。

## 2026-10-08

- P2 补齐地形采样 / 坡度坡向 / 剖面、通视 / 径向视域、PostProcess。

## 2026-10-08

- P2 补齐空间查询、Globe 剖切、地形夸张。

## 2026-10-08

- P2 补齐视域贴地可视化、土方挖填、开挖剖切。
