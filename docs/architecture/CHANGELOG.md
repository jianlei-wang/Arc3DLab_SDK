# 设计迭代日志

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
