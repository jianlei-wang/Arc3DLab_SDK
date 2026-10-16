# Requirements Document

## Introduction

`packages/engine-cesium/src/credits.ts` 的 `CreditManager` 负责 Cesium 版权信息的展示模式。当前实现把两件事混在一起：

- `compact` 模式直接把版权容器 `creditContainer` 的 `display` 设为 `none`，会连同第三方数据源署名一起隐藏，存在合规风险。
- `custom` 模式把版权容器移动到业务指定的 DOM 节点，但切回 `default` 时只把 `display` 置空，没有把容器移回原始父节点，导致原始布局位置丢失、`getContainer()` 语义混乱。

本特性把「布局压缩」与「版权信息是否显示」分开：

- `compact` 保留版权信息可见（不隐藏容器），只压缩占位（缩小字号、行高与内边距）。
- 任一模式切换前先把容器恢复到原始父节点并清除本管理器施加的样式，使模式可反复切换、位置可逆。
- 保留 `custom` 的挂载能力与 `default` 的原生位置，且弱化对 `HTMLElement` 全局构造器的依赖，便于在无 DOM 环境测试。

## Glossary

- **版权容器（creditContainer）**：`viewer.cesiumWidget.creditContainer`，承载 Cesium 与第三方数据源署名的元素。
- **原始父节点（originalParent）**：构造 `CreditManager` 时版权容器的父节点。
- **基线 display（baselineDisplay）**：构造时版权容器的 `style.display` 原值。
- **挂载目标（custom container）**：`custom` 模式下接收版权容器的业务 DOM 节点。

## Requirements

### Requirement 1: 布局压缩不隐藏版权信息

**User Story:** AS 集成方, I want compact 模式压缩布局而非隐藏版权, so that 第三方数据源署名始终合规可见。

#### Acceptance Criteria

1. WHEN 设置 `compact` 模式, THE 版权容器的 `display` SHALL NOT 为 `none`。
2. WHEN 设置 `compact` 模式, THE 版权容器 SHALL 保持在其原始父节点下。
3. WHEN 设置 `compact` 模式, THE 容器 SHALL 应用压缩布局样式（缩小字号、行高、内边距）。
4. WHEN `getContainer()` 在 `compact` 或 `default` 模式下被调用, THE 返回 SHALL 为原生版权容器。

### Requirement 2: 模式切换可逆且恢复原始位置

**User Story:** AS 集成方, I want 在模式间反复切换后版权容器回到原始位置, so that 布局不会因切换而错乱。

#### Acceptance Criteria

1. WHEN 设置 `custom` 模式并提供可挂载的容器, THE 版权容器 SHALL 被移动到该容器内，且 `getContainer()` SHALL 返回该容器。
2. WHEN 从任何模式切回 `default`, THE 版权容器 SHALL 回到原始父节点，`display` SHALL 恢复为基线值，压缩样式 SHALL 被清除。
3. WHEN 依次执行 `default → custom → compact → default`, THE 每一步后版权容器 SHALL 位于该模式期望的父节点，最终位置 SHALL 等于原始父节点。
4. WHEN `custom` 模式未提供可挂载容器, THE 模式 SHALL 回退为不移动容器且不压缩的默认表现。

### Requirement 3: 可测试性

**User Story:** AS 维护者, I want 在无 DOM 环境下验证模式切换, so that 该合同可被单测覆盖。

#### Acceptance Criteria

1. WHEN 判定 `custom` 容器是否可挂载, THE 判定 SHALL 依据其是否具备节点挂载能力，SHALL NOT 依赖 `HTMLElement` 全局构造器。
