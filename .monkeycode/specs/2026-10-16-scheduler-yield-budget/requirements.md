# Requirements Document

## Introduction

`@arc3dlab/analysis` 的分块调度器（`packages/analysis/src/scheduler.ts`）负责在长耗时分析中让出主线程、限制采样规模并汇报进度。当前实现存在三处不足：

- **让出只是微任务**：`mapInChunks()` 在每块结束后执行 `await Promise.resolve()`。微任务让出不会把控制权交还给浏览器事件循环，渲染帧、输入事件与超时回调无法在块间执行，长分析（可视域、地形剖面、大规模采样）仍会阻塞界面。
- **采样规模只有单次上限**：`AnalysisTaskOptions.maxSamples` 只在单次调用（如单条射线、单个剖面）内生效，没有「任务级累计预算」的概念。可视域这类由多个子操作组成的任务会按子操作各自限额，累计采样量可以远超预期。
- **Worker 宿主是占位实现**：`worker-host.ts` 的 `AnalysisJobHost` 名为 Worker 宿主，实际在进程内用 `queueMicrotask` 同步执行作业；`jobs.ts` 中的纯数值作业（矩形/多边形查询、面积、土方网格）本可离线计算，却仍占用主线程。

本特性补齐三块能力：块间真实让出（默认宏任务）、任务级累计采样预算（超限明确报错）、以及真实 Web Worker 执行纯数值作业（不可用时降级）。

范围决策（已确认）：

- **让出机制**：新增 `yieldToEventLoop()`，默认使用真实宏任务让出（`MessageChannel`，不可用时回退 `setTimeout(0)`）；保留微任务让出作为可选项，由 `AnalysisTaskOptions.yieldStrategy` 选择，缺省为宏任务。`mapInChunks()` 与 `sampleCartographics()` 的块间让出统一走该函数。
- **预算语义**：新增 `AnalysisSampleBudget`，以「任务级累计采样数」为口径；`reserve(count)` 在累计量超过 `maxSamples` 时抛 `Arc3DError("INVALID_ARGUMENT")`。任务的多个子操作共享同一预算实例（可视域即由全部射线共享）。单次调用的既有 `maxSamples` 截断行为保持不变。
- **Worker 范围**：仅 `jobs.ts` 中纯数值（不依赖 Cesium 场景/引擎对象）的作业可在 Worker 中执行。作业与结果必须可结构化克隆；不可克隆的输入在 `run()` 前以 `Arc3DError("INVALID_FORMAT")` 拒绝。取消语义保持抛 `Arc3DError("CANCELLED")`，跨线程错误经 `serializeAnalysisError` / `restoreAnalysisError` 还原错误码。运行环境无 `Worker` 时降级为进程内执行，行为与现有实现一致。
- **改造范围**：`packages/analysis/src/scheduler.ts`、`sampler.ts`、`visibility.ts`、`worker-host.ts`、`jobs.ts` 相关导出，以及新增 `worker-protocol.ts`、`analysis-worker-entry.ts`；测试与文档同步。不改变 `AnalysisJob` / `AnalysisJobResult` 类型结构与 `executeAnalysisJob` 的同步语义。

## Glossary

- **让出（Yield）**：在分块计算之间把控制权交还给事件循环，使其它待处理任务得以运行。
- **宏任务让出（Macrotask Yield）**：通过 `MessageChannel`（或 `setTimeout`）让出，允许渲染帧、输入与超时回调执行。
- **微任务让出（Microtask Yield）**：仅通过 `await Promise.resolve()` 让出，不进入下一轮事件循环。
- **任务级采样预算（Task-level Sample Budget）**：一次分析任务允许消耗的累计采样点上限，由任务内所有子操作共同分摊。
- **采样点（Sample）**：一次地形高程采样，对应 `SampledHeight` 中的一项。
- **纯数值作业（Pure Numeric Job）**：`jobs.ts` 中 `AnalysisJob` 描述的、只依赖输入数据与纯计算函数的作业，不访问 Cesium 场景或引擎对象。
- **作业宿主（Job Host）**：`AnalysisJobHost`，负责调度、取消并（在可用时）于独立线程执行作业的对象。

## Requirements

### Requirement 1: 块间真实让出

**User Story:** AS 使用分析能力的开发者, I want 分块计算在块间真正让出主线程, so that 长分析期间界面仍能渲染并响应输入。

#### Acceptance Criteria

1. WHEN `mapInChunks()` 完成一个块, THE 调度器 SHALL 通过 `yieldToEventLoop()` 让出控制权。
2. WHILE 未显式指定 `yieldStrategy`, THE `yieldToEventLoop()` SHALL 采用宏任务让出，使待处理的宏任务（如 `setTimeout` 回调）能在块间执行。
3. WHEN `yieldStrategy` 显式设为 `"microtask"`, THE `yieldToEventLoop()` SHALL 仅通过微任务让出。
4. WHEN 运行环境不提供 `MessageChannel`, THE 宏任务让出 SHALL 回退为 `setTimeout(0)`。
5. WHEN `sampleCartographics()` 处理的坐标数超过一个块, THE 该函数 SHALL 在块间调用 `yieldToEventLoop()`，并按 `AnalysisTaskOptions.yieldStrategy` 选择策略。

### Requirement 2: 任务级累计采样预算

**User Story:** AS 使用分析能力的开发者, I want 为一次分析设定累计采样上限, so that 由多个子操作组成的任务不会因逐次限额而失控。

#### Acceptance Criteria

1. WHEN 通过 `AnalysisSampleBudget.reserve(count)` 请求采样且 `used + count` 不超过 `maxSamples`, THE 预算 SHALL 累加 `used` 并返回被接受的采样数。
2. WHEN 请求采样导致 `used + count` 超过 `maxSamples`, THE `reserve()` SHALL 抛出 `Arc3DError("INVALID_ARGUMENT")`，且 `used` SHALL NOT 被修改。
3. WHEN 一次可视域分析携带 `maxSamples`, THE 可视域 SHALL 创建单一预算实例并令其全部射线与观察点采样共享该实例。
4. WHEN 共享预算在任一子操作处被耗尽, THE 可视域分析 SHALL 以超限错误结束，且不再继续后续子操作。
5. WHEN 单次 `sampleCartographics()` 调用在未提供共享预算时被调用, THE 该函数 SHALL 以自身 `maxSamples`（缺省为本次坐标数）构造预算，从而保持既有的单次截断行为且不抛超限错误。

### Requirement 3: 真实 Worker 执行纯数值作业

**User Story:** AS 使用分析能力的开发者, I want 纯数值分析作业在独立线程执行, so that 主线程不被计算阻塞。

#### Acceptance Criteria

1. WHEN 运行环境提供 `Worker` 且宿主尚未降级, THE `AnalysisJobHost.run()` SHALL 把作业投递到 Worker 执行，并以作业标识匹配回复。
2. WHEN 作业或其输入不可结构化克隆, THE `AnalysisJobHost.run()` SHALL 在投递前抛出 `Arc3DError("INVALID_FORMAT")`。
3. WHEN Worker 返回失败, THE `AnalysisJobHost.run()` SHALL 抛出经 `restoreAnalysisError()` 还原得到的 `Arc3DError`，并保留原始错误码。
4. WHEN 运行中的作业被 `AbortSignal` 取消, THE `AnalysisJobHost` SHALL 终止该 Worker 并以 `Arc3DError("CANCELLED")` 拒绝待处理作业。
5. WHEN 运行环境不提供 `Worker` 或 Worker 创建失败, THE `AnalysisJobHost.run()` SHALL 降级为进程内执行并返回相同结果。
6. WHEN `AnalysisJobHost.destroy()` 被调用, THE 宿主 SHALL 终止 Worker 并以 `Arc3DError("CANCELLED")` 拒绝所有未完成作业。

## Out of Scope

- 为依赖 Cesium 场景的分析（地形采样、通视、可视域、土方）引入 Worker；这些操作需要引擎对象，保持主线程执行。
- Worker 线程池与多作业并行调度。
- 真实坐标重投影与单位换算（由 `@arc3dlab/core` 的空间参考能力负责）。
