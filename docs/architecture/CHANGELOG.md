# 设计迭代日志

## 2026-10-09

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
