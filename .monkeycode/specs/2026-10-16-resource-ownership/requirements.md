# Requirements Document

## Introduction

Arc3D SDK 在多个子系统中创建原生 Cesium 资源，但资源的所有权、登记与释放路径不统一，导致对象泄漏、共享状态被无条件接管、以及状态恢复缺失。本轮梳理六处契约级缺陷：

1. `GraphicManager.addVoxel()` / `addFlatten()`（`packages/graphics/src/graphic-manager.ts:113-139`）返回的 `MultiTileVoxel` / `ModelFlatten` 既未登记到 `context.registry`，也不在 `GraphicManager.clear()` 的释放链路中，`clear()` 只遍历 `this.items`（受管图形），体素与压平对象永不释放。
2. `EffectsManager.destroy()`（`packages/effects/src/index.ts:126-134`）只释放天气与后处理，未释放粒子句柄；`ParticleManager` 无托管列表也无 `destroy()`。
3. `createBaseSystem()`（`packages/effects/src/particles.ts:286-330`）无条件把 `viewer.clock.shouldAnimate` 置为 `true`，销毁粒子后不恢复，污染应用级共享的时钟状态。
4. `SceneController.sync()`（`packages/scene/src/scene-controller.ts:155-170`）返回独立的 `SyncViewer`，控制器不跟踪，`scene.destroy()` 不解除其相机事件监听，造成监听器泄漏。
5. `DataManager.add()`（`packages/data/src/index.ts:120-143`）的句柄 `onDestroy` 注销了图层与注册表项，但未注销 `registerAsset` 登记的资产元数据，资产在 `DataCatalog` 中泄漏。
6. `ManagedGraphic.positions`（`packages/graphics/src/managed-graphic.ts:55-75`）直接返回内部数组引用，调用方原地修改会绕过变更通知与内部状态同步。

本特性为这三类资源建立统一合同：

- **SDK 完全拥有**：图形、粒子系统、体素图元等由 SDK 创建的运行时资源，由对应 Manager 统一登记，可经单对象或应用级销毁释放，重复销毁安全。
- **SDK 暂时管理的外部对象**：外部瓦片集、裁剪目标等，明确 SDK 会改写哪些状态，销毁时恢复还是仅解除引用。
- **应用级共享状态**：场景时钟、渲染策略、Credits、Globe 裁剪等，在覆盖前保存原值并在销毁时按序恢复。

## Glossary

- **Owned Resource（自有资源）**：由 SDK 创建并负责释放的资源，登记到 `context.registry` 或由所属 Manager 的托管集合管理。
- **Managed Handle（托管句柄）**：实现 `DisposableResource` / `ResourceHandle` 合同、`destroy()` 幂等的运行时句柄。
- **Baseline（基线）**：SDK 首次改写某个共享状态或外部对象属性之前捕获的原值。
- **Shared State（共享状态）**：位于 `Viewer` / `Scene` / `Globe` 上、可能被 SDK 之外代码共用的可变状态。

## Requirements

### Requirement 1: 体素与压平对象纳入统一所有权

**User Story:** AS 使用体素或压平的开发者, I want 这些对象随管理器或应用销毁被释放, so that 不依赖手动清理也不产生图元泄漏。

#### Acceptance Criteria

1. WHEN `GraphicManager.addVoxel()` 或 `addFlatten()` 成功返回, THE 返回对象 SHALL 被登记，可经其自身的 `destroy()` 与所在管理器的应用级销毁释放。
2. WHEN `GraphicManager.clear()` 执行, THE 由该管理器创建的体素与压平对象 SHALL 被一并释放。
3. WHEN 体素或压平对象的 `destroy()` 被重复调用, THE 该方法 SHALL 为幂等空操作。
4. WHEN `GraphicManager.addVoxel()` / `addFlatten()` 在应用已销毁时调用, THE 方法 SHALL 抛出 `Arc3DError`，错误码为 `APP_DESTROYED`。
5. WHEN SDK 释放 `ModelFlatten`, THE SDK SHALL 仅在其目标 `clippingPolygons` 仍指向自身集合时解除关联，绝不覆盖外部替换后的集合引用。

### Requirement 2: 粒子句柄纳入效果管理器生命周期

**User Story:** AS 使用粒子特效的开发者, I want `EffectsManager.destroy()` 释放全部粒子, so that 应用销毁后无残留粒子系统与事件监听。

#### Acceptance Criteria

1. WHEN `ParticleManager` 创建粒子句柄, THE 句柄 SHALL 被该管理器跟踪。
2. WHEN `EffectsManager.destroy()` 执行, THE 全部已创建且未销毁的粒子句柄 SHALL 被释放。
3. WHEN 粒子句柄在管理器销毁前已被手动 `destroy()`, THE 管理器销毁 SHALL NOT 重复释放或抛错。
4. THE 粒子句柄 `destroy()` SHALL 保持幂等。

### Requirement 3: 应用级共享状态覆盖与恢复

**User Story:** AS 需要与其它子系统共存的开发者, I want SDK 只在必要时改写共享状态并在销毁时恢复, so that 我的场景配置不被动改变。

#### Acceptance Criteria

1. WHEN 粒子创建首次改写 `viewer.clock.shouldAnimate`, THE SDK SHALL 在改写前捕获其原值。
2. WHEN 与粒子相关的释放完成后无其它活动需求, THE SDK SHALL 将 `viewer.clock.shouldAnimate` 恢复为捕获的原值。
3. WHEN 多个粒子共存, THE SDK SHALL 以引用计数方式管理 `shouldAnimate` 的覆盖，仅在计数归零时恢复。
4. WHEN 未发生任何覆盖, THE SDK SHALL NOT 改写共享状态。

### Requirement 4: 多屏联动监听器纳入场景生命周期

**User Story:** AS 使用多屏联动的开发者, I want 场景销毁时自动解除联动监听, so that 不产生事件监听器泄漏。

#### Acceptance Criteria

1. WHEN `SceneController.sync()` 成功返回, THE 返回的 `SyncViewer` SHALL 被场景控制器跟踪。
2. WHEN `SceneController.destroy()` 执行, THE 全部已创建且未销毁的 `SyncViewer` SHALL 被 `destroy()`，解除相机事件监听。
3. WHEN `SyncViewer` 已被手动 `destroy()`, THE 场景销毁 SHALL NOT 重复释放或抛错。

### Requirement 5: 数据资产元数据随句柄释放

**User Story:** AS 使用数据源管理的开发者, I want 销毁数据源句柄时同时注销其资产元数据, so that 目录不残留悬挂资产。

#### Acceptance Criteria

1. WHEN `DataManager.add()` 成功, THE 句柄销毁时 SHALL 同时注销对应图层与资产元数据。
2. WHEN 注册表登记阶段失败, THE 已登记的资产与图层元数据 SHALL 被回滚，不残留。
3. WHEN 句柄 `destroy()` 被重复调用, THE 注销 SHALL 只发生一次。
4. WHEN 数据源加载失败, THE 已登记的资产与图层 SHALL 作为一致的失败记录保留（现有行为），避免图层悬挂引用不存在的资产。

### Requirement 6: 受管图形坐标只读副本

**User Story:** AS 使用受管图形的开发者, I want 读取 `positions` 不暴露内部状态, so that 外部修改不会绕过变更通知。

#### Acceptance Criteria

1. WHEN 读取 `ManagedGraphic.positions`, THE 返回 SHALL 为防御性副本，修改返回值不影响内部状态。
2. WHEN 通过 `setPositions()` 或创建时提供坐标, THE 内部状态 SHALL 保存独立副本，修改入参不影响内部状态。

## Out of Scope

- 重构 `ResourceRegistry` / `ResourceTracker` / `DisposerStack` / `PluginScope` 的既有公共 API。
- 为所有子系统引入新的独立清理机制。
- 修改与本特性无关的渲染行为。

## Decision Log（待确认）

- **D1 体素/压平所有权登记方式**：待确认（推荐登记进共享 `ResourceRegistry` 并纳入 `GraphicManager` 生命周期）。
- **D2 粒子句柄与时钟共享状态**：待确认（推荐由 `EffectsManager`/`ParticleManager` 统一托管句柄并引用计数恢复 `shouldAnimate`）。
- **D3 其余合同修复范围**：待确认（`SyncViewer` 跟踪、`DataManager` 资产注销、`ManagedGraphic.positions` 副本是否全部纳入本迭代）。
