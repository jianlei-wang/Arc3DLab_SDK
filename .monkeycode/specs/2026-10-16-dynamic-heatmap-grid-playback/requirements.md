# Requirements Document

## Introduction

`DynamicHeatmapOverlay`（`packages/analysis/src/dynamic-heatmap.ts`）在 `setFrames()` 中为每一帧预计算并缓存了网格（`computeHeatmapGrid`），并导出了 `interpolateHeatmapGrid()` 用于帧间平滑过渡。但 `showFrame()` 仍把该帧的原始点集交给 `HeatmapOverlay.setData()`，由后者重新计算网格；预计算网格与插值函数都没有被使用。结果是：既浪费了 `setFrames` 的预计算，`play()` 也只是逐帧硬切，而不是已实现能力的平滑网格插值。

本特性让预计算网格真正发挥作用：渲染改为直接使用缓存网格，播放改为在相邻缓存网格之间插值。范围决策（已确认）：

- **渲染入口**：`HeatmapOverlay` 新增 `setGrid(grid, options)`，直接从网格渲染；`setData(points, options)` 保持不变（内部先算网格再委托 `setGrid`），既有调用方无需改动。
- **帧渲染**：`DynamicHeatmapOverlay.showFrame()` 改用缓存网格渲染，不再对点集重复计算。
- **播放插值**：`play(intervalMs, steps)` 在相邻帧网格之间按进度插值（`interpolateHeatmapGrid`）并渲染，每个帧间隔结束时前进到下一帧；相邻网格维度不一致时回退为该帧网格。
- **保留接口**：`setFrames` 继续预计算并缓存网格数组；`interpolateHeatmapGrid` 保留并成为播放路径的实际依赖。不删除任何公共导出。

## Glossary

- **缓存网格（Cached Grid）**：`setFrames()` 为每帧预计算并保存的 `HeatmapGrid`。
- **帧间隔（Frame Interval）**：`play(intervalMs)` 中相邻两帧之间的过渡时长。
- **插值步（Interpolation Step）**：一个帧间隔内被拆分为的若干子渲染时刻，用于产生平滑过渡。
- **硬切（Hard Cut）**：不插值、直接从一个帧网格切换到下一个帧网格。

## Requirements

### Requirement 1: 帧渲染使用缓存网格

**User Story:** AS 使用动态热力图的开发者, I want 帧切换直接使用预计算网格, so that 不会为同一帧重复计算网格。

#### Acceptance Criteria

1. WHEN `setFrames(frames)` 已预计算网格, THE `showFrame(index)` SHALL 使用该索引对应的缓存网格渲染。
2. WHEN `showFrame(index)` 渲染缓存网格, THE 该调用 SHALL NOT 对其点集再次调用网格计算。
3. WHEN `index` 超出范围, THE `showFrame(index)` SHALL 按环形取模选择帧。

### Requirement 2: 播放使用网格插值

**User Story:** AS 使用动态热力图的开发者, I want 播放时在帧之间平滑过渡, so that 动态热力图呈现连续变化而非硬切。

#### Acceptance Criteria

1. WHEN `play(intervalMs, steps)` 被调用且帧数不少于 2, THE 播放 SHALL 按固定子间隔在相邻帧的缓存网格之间插值并渲染。
2. WHEN 一个帧间隔结束, THE 播放 SHALL 前进到下一帧，并以该帧作为下一段过渡的起点。
3. WHEN 相邻缓存网格的维度不一致, THE 插值 SHALL 回退为该起始帧网格，并在帧间隔结束时切换到目标帧。
4. WHEN 帧数少于 2, THE `play` SHALL NOT 启动播放定时器。
5. WHEN `pause()` 或 `clear()` 被调用, THE 播放 SHALL 停止且不再渲染插值帧。

### Requirement 3: 网格渲染入口

**User Story:** AS 使用热力图的开发者, I want 从已有网格直接渲染, so that 复用计算结果而不重复计算。

#### Acceptance Criteria

1. WHEN `HeatmapOverlay.setGrid(grid, options)` 被调用, THE 该调用 SHALL 依据传入网格与渐变渲染热力图，SHALL NOT 计算新网格。
2. WHEN `HeatmapOverlay.setData(points, options)` 被调用, THE 该调用 SHALL 计算网格并委托 `setGrid`，其可观察结果 SHALL 与既有实现一致。
3. WHEN 运行上下文不可用, THE `setGrid` SHALL 抛出 `Arc3DError("APP_DESTROYED")`。

## Out of Scope

- 改变 `HeatmapOverlay` 的图元复用策略（仍为每次渲染重建实体）。
- 逐帧独立渲染选项的插值（过渡期间以起始帧的渲染选项为准）。
- 为 `DynamicHeatmapOverlay` 引入 `requestAnimationFrame` 时间轴或 GPU 纹理过渡。
