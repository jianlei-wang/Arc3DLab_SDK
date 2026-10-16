# Requirements Document

## Introduction

`@arc3dlab/data` 的 `createImageryProvider()`（`packages/data/src/providers.ts`）在创建 Ion 影像时直接调用：

```ts
return IonImageryProvider.fromAssetId(spec.assetId)
```

该路径既不读取当前实例配置的 Ion 令牌（`config.engine.cesium.ionToken` / `config.tokens.cesiumIon`），也不经过引擎层已定义的串行化 Token 作用域（`SerialIonTokenScope` / `withIonAccessToken`）。同一仓库中，地形（`packages/layers/src/terrain.ts`）与 3D Tiles（`packages/layers/src/tileset.ts`）都通过 `readIonToken(config)` + `withIonAccessToken(...)` 进入该作用域，Ion 影像因此成为唯一例外。

后果：

- 应用配置的 Ion Token 不保证应用到 Ion 影像请求，认证行为在影像、地形、Tileset 之间不一致。
- 同一页面存在多个具有不同令牌的 SDK 实例时，Ion 影像请求可能读取到其他实例或外部临时写入的全局令牌。

本特性将令牌的“取得、应用、异步执行、恢复”统一到一套实例级合同，使所有 Ion 相关创建都经同一路径，业务模块不再各自读取或改写 Cesium 全局令牌状态。

范围决策（待确认）：

- **保留串行作用域语义**：`SerialIonTokenScope`（排队进入、退出恢复、无 token 也排队）保持不变，作为实例级合同底层实现。
- **公共入口保持可用**：`Arc3D.create` / `Arc3DConfig` 的令牌配置形状不变。

## Glossary

- **Ion Token**：Cesium Ion 访问令牌，来自 `config.engine.cesium.ionToken` 或 `config.tokens.cesiumIon`，二者等价。
- **Ion Token Scope（令牌作用域）**：`SerialIonTokenScope`，在临界区内临时设置 `Cesium.Ion.defaultAccessToken` 并在退出时恢复，且所有调用串行排队。
- **Instance-level Contract（实例级合同）**：把“读取实例令牌 + 在作用域内执行异步工作”封装成运行时上下文可调用的统一入口。
- **Ion Operation（Ion 操作）**：任何依赖 Ion 令牌的资源创建，包括 Ion 影像、Ion 地形、Ion Tileset。
- **Global Token State（全局令牌状态）**：`Cesium.Ion.defaultAccessToken`。

## Requirements

### Requirement 1: 实例级令牌合同

**User Story:** AS SDK 维护者, I want 一套实例级令牌执行入口, so that 所有 Ion 操作走同一路径。

#### Acceptance Criteria

1. THE 运行时上下文 SHALL 暴露一个实例级入口，用于在“本实例令牌 + Ion Token Scope”下执行一段异步工作。
2. THE 该入口 SHALL 从实例配置解析令牌（`engine.cesium.ionToken` 优先，其次 `tokens.cesiumIon`）。
3. WHERE 调用方提供覆盖令牌, THE 该入口 SHALL 使用覆盖令牌替代实例令牌。
4. WHEN 实例令牌与覆盖令牌都未提供, THE 该入口 SHALL 按无 token 分支执行工作。
5. THE 该入口 SHALL 在缺少引擎能力的环境（如无引擎的单元测试上下文）中回退为直接执行工作。

### Requirement 2: Ion 影像走统一路径

**User Story:** AS 集成 Ion 影像的开发者, I want 影像请求使用本实例配置的令牌, so that 认证行为与其他 Ion 资源一致。

#### Acceptance Criteria

1. WHEN `createImageryProvider()` 创建 Ion 影像, THE 该调用 SHALL 在实例级令牌入口内执行 `IonImageryProvider.fromAssetId`。
2. WHEN 实例配置了 Ion 令牌, THE Ion 影像请求 SHALL 使用该令牌。
3. WHILE Ion 影像在创建中, THE 全局令牌状态 SHALL 在该临界区内被设置并在结束后恢复。
4. THE `ProviderSpec` 中已有的 `token` 字段 SHALL 作为该 Ion 影像的覆盖令牌。
5. IF `assetId` 未提供, THEN THE `createImageryProvider()` SHALL 抛出 `Arc3DError`，错误码为 `INVALID_ARGUMENT`。

### Requirement 3: 地形与 Tileset 收敛到同一入口

**User Story:** AS SDK 维护者, I want 地形与 Tileset 也使用同一实例级入口, so that Ion 认证行为只有一处实现。

#### Acceptance Criteria

1. WHEN 设置 Ion 地形, THE `TerrainManager` SHALL 通过实例级令牌入口执行 `CesiumTerrainProvider.fromIonAssetId`。
2. WHEN 添加 Ion Tileset, THE `TilesetManager` SHALL 通过实例级令牌入口执行 `Cesium3DTileset.fromIonAssetId`。
3. THE `TerrainManager` 与 `TilesetManager` SHALL 不再直接组合 `readIonToken` 与 `withIonAccessToken`。
4. THE 现有错误语义 SHALL 保持：Ion 地形在无令牌时抛 `AUTH_FAILED`。

### Requirement 4: 并发与恢复正确性

**User Story:** AS SDK 维护者, I want 多实例并发下的令牌隔离, so that 不同实例的 Ion 请求不互相串扰。

#### Acceptance Criteria

1. WHEN 多个实例并发执行 Ion 操作, THE 各操作的令牌设置与恢复 SHALL 按串行顺序执行。
2. WHEN 一次 Ion 操作结束, THE 全局令牌状态 SHALL 恢复为该操作开始前的值。
3. IF 一次 Ion 操作抛错, THEN THE 全局令牌状态 SHALL 仍被恢复。

### Requirement 5: 验证

**User Story:** AS SDK 维护者, I want 令牌路径可被自动验证, so that 回归可被检测。

#### Acceptance Criteria

1. THE 测试 SHALL 断言 Ion 影像创建读取了实例令牌（在作用域内观察到该令牌）。
2. THE 测试 SHALL 断言 Ion 影像创建结束后恢复原始全局令牌。
3. THE 测试 SHALL 覆盖覆盖令牌优先于实例令牌、无令牌回退、`assetId` 缺失报错。
4. THE 测试 SHALL 覆盖地形与 Tileset 经同一入口后仍保持既有错误语义。
5. THE 测试 SHALL 覆盖多实例使用不同令牌时互不串扰。

## Decisions

以下问题已确认：

1. **合同位置**：在 `EngineContext`（core）新增可选方法 `runWithIonToken(work, token?)`，由 engine-cesium 在 `createCesiumEngineContext` 绑定实例令牌与共享串行作用域；core 提供容错封装 `runWithIonToken(context, work, token?)`，无引擎能力时直接执行工作。
2. **数据层 API 形状**：`createImageryProvider(spec, options?)` 与 `createProviderHandle(spec, options?)` 的第二参数由 `fallbackToken: string` 改为选项对象 `{ tdtToken?, runWithIonToken? }`；Ion 分支通过 `runWithIonToken` 执行。属于数据包内的破坏性签名调整，仓库内调用点同步更新。
3. **Ion 影像无令牌行为**：无令牌时仍按无 token 分支创建，保留 Cesium 自带默认令牌的可能，不因未配置而阻断。
