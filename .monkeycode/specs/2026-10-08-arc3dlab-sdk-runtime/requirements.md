# Requirements Document

## Introduction

将 Arc3DLab 从 Cesium 二次封装原型升级为可维护、可扩展的 3D WebGIS Runtime SDK。第一阶段交付可靠运行时底座、组合式公共 API，以及可继续迭代的设计框架。

## Glossary

- **Arc3DApp**：SDK 运行时根对象
- **Engine Adapter**：渲染引擎适配层，首个实现为 CesiumEngine
- **Layer**：栅格、地形、切片等图层资源
- **Graphic**：点、线、面等要素资源
- **ResourceHandle**：统一资源句柄，包含 id、native、owned、destroy
- **Legacy Viewer**：兼容旧 `new Viewer()` 入口的适配器

## Requirements

### Requirement 1：运行时入口

**User Story:** AS WebGIS 开发者, I want 通过 `Arc3D.create()` 创建场景运行时, so that 我可以用稳定的应用对象操作三维场景

#### Acceptance Criteria

1. WHEN 调用方传入 container 与可选配置, THE Arc3DLab SDK SHALL 返回 `Promise<Arc3DApp>`
2. WHEN Arc3DApp 创建完成, THE Arc3DLab SDK SHALL 发出 `ready` 事件
3. WHEN 调用 `app.destroy()`, THE Arc3DLab SDK SHALL 回收事件、UI 监听与 owned 资源，并将生命周期置为 `destroyed`

### Requirement 2：引擎解耦

**User Story:** AS SDK 维护者, I want Core 独立于 Cesium 类型, so that 运行时可以测试并且未来可替换引擎

#### Acceptance Criteria

1. THE `@arc3dlab/core` package SHALL 在源码中保持对 `cesium` 模块的零导入
2. WHEN 创建应用, THE SDK SHALL 通过 Engine Adapter 创建底层 Viewer
3. THE Arc3DApp SHALL 通过 `app.native.viewer` 暴露底层 Viewer 供高级用法使用

### Requirement 3：安全配置

**User Story:** AS 应用集成方, I want 在运行时注入服务 Token, so that SDK 发布物不包含真实凭据

#### Acceptance Criteria

1. THE SDK 源码默认配置 SHALL 使用空 Token 占位
2. WHEN 调用方提供 `engine.cesium.ionToken`, THE CesiumEngine SHALL 将该 Token 写入当前实例
3. WHEN 调用方添加天地图底图, THE BasemapManager SHALL 使用调用方传入的 token 字段

### Requirement 4：图层与要素分离

**User Story:** AS 业务开发者, I want 用 layers 管理底图影像、用 graphics 管理点线面, so that API 符合 GIS 语义

#### Acceptance Criteria

1. THE `app.layers` API SHALL 管理 imagery / tileset / data layer
2. THE `app.graphics` API SHALL 提供 addPoint / addPolyline / addPolygon
3. WHEN 创建 Polygon 且包含 outline, THE Graphic SHALL 作为单一资源回收 fill 与 outline

### Requirement 5：交互与 UI 生命周期

**User Story:** AS 应用开发者, I want 场景销毁后不再残留事件与 DOM 提示, so that 页面可以反复创建地图

#### Acceptance Criteria

1. WHEN InteractionManager 销毁, THE SDK SHALL 销毁 ScreenSpaceEventHandler
2. THE TooltipService SHALL 使用 `textContent` 设置提示文本
3. THE TooltipService SHALL 使用相对 canvas 的坐标定位

### Requirement 6：兼容层

**User Story:** AS 现有示例维护者, I want 继续使用 `new Viewer()`, so that 旧代码可以渐进迁移

#### Acceptance Criteria

1. THE `Viewer` export SHALL 作为 Legacy Adapter 存在
2. WHEN 使用 `new Viewer(container)`, THE Adapter SHALL 同步创建 Arc3DApp 并挂到 `viewer.app`
3. THE 文档主路径 SHALL 以 `Arc3D.create()` 为准

### Requirement 7：工程治理

**User Story:** AS 发布负责人, I want 许可证、构建和测试与 SDK 定位一致, so that 1.0 可以工程化发布

#### Acceptance Criteria

1. THE `package.json` license 字段 SHALL 与根目录 LICENSE 同为 GPL-2.0-only
2. THE 构建系统 SHALL 产出 ESM 与类型声明
3. THE core 模块 SHALL 具备 EventBus、Lifecycle、ResourceRegistry 的单元测试
