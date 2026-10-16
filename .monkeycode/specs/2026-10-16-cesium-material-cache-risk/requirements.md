# Requirements Document

## Introduction

`packages/effects/src/materials.ts` 的 `registerArc3DMaterials()` 与 `packages/graphics/src/dynamic/materials.ts` 的 `registerRadarNormalMaterial()` 通过 `Material._materialCache.addMaterial(...)` 向 Cesium 注册自定义材质。`_materialCache` 是 Cesium 的带下划线内部实现入口：Cesium 1.146.0 没有公开的材质注册 API，连 `Material.fromType` 自身也消费同一缓存。SDK 已把 `cesium` 精确锁定在 1.146.0，因此这不是当前必须重写的故障，但仍属于版本升级时的高风险点。

本特性不改写注册机制，而是把它显式纳入治理：

- 在兼容性文档中登记该内部 API 依赖为 Cesium 升级高风险点，并声明它不属于稳定公开接口。
- 增加针对锁定版本的材质注册集成测试，作为升级时的护栏。
- 在架构文档中说明内置材质注册所依赖的内部入口。

## Glossary

- **内部材质缓存（material cache）**：`Material._materialCache`，含 `_materials` / `addMaterial` / `getMaterial`，为 Cesium 私有实现。
- **版本契约测试**：针对锁定版本、验证 SDK 所依赖的内部结构仍然成立的集成测试。

## Requirements

### Requirement 1: 登记升级高风险点

**User Story:** AS SDK 维护者, I want 内部 API 依赖被显式记录, so that 升级 Cesium 前能识别并处理该风险。

#### Acceptance Criteria

1. WHEN 查阅兼容性与版本策略文档, THE 文档 SHALL 列出 SDK 依赖的 Cesium 内部 API（至少包含 `Material._materialCache`）及其使用位置。
2. WHEN 记录该依赖, THE 文档 SHALL 声明它不属于 Arc3DLab 的稳定公开合同，不得被无限期依赖。
3. WHEN 记录该依赖, THE 文档 SHALL 给出缓解措施（精确版本锁定、访问守卫、版本契约测试、升级核查）。
4. WHEN 查阅内置材质注册的架构说明, THE 说明 SHALL 指出注册依赖 Cesium 内部入口并引用兼容性文档。

### Requirement 2: 针对锁定版本的集成测试

**User Story:** AS SDK 维护者, I want 版本契约被自动化测试覆盖, so that Cesium 升级破坏该内部结构时能被立即发现。

#### Acceptance Criteria

1. WHEN 运行集成测试, THE 测试 SHALL 断言 `Material._materialCache` 存在且具备 `addMaterial` / `getMaterial` 两个函数。
2. WHEN `registerArc3DMaterials()` 与 `registerRadarNormalMaterial()` 执行后, THE 测试 SHALL 断言动态扩散、线尾迹、雷达三类材质的模板已进入缓存，且模板 `fabric.type` 与其类型名一致、`fabric.source` 含 `czm_getMaterial`。
3. WHEN 对无纹理 uniform 的已注册材质调用 `Material.fromType`, THE 测试 SHALL 断言返回材质的 `type` 正确且 `shaderSource` 含 `czm_getMaterial`。

## Out of Scope

- 替换 `_materialCache` 为其他注册方式（Cesium 1.146.0 无公开替代）。
- 在无 WebGL 的单测环境中做 GPU 级渲染断言。
- 统一 effects 与 graphics 两处注册实现。
