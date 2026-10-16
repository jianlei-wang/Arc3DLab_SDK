# Requirements Document

## Introduction

`@arc3dlab/scene` 的 `captureGrid()`（`packages/scene/src/shot-grid.ts`）对外承诺“按网格分幅导出场景图片”，但当前实现存在两个影响正确性与可用性的缺陷：

- **图像与目标范围不一致**：循环体只做 `setView` → 可选 `delayMs` → `canvas.toDataURL()`。默认 `delayMs` 为 `0`，既不请求也不等待与当前视图对应的渲染帧；在按需渲染（`requestRenderMode`）下，画布可能仍是上一视图或上一帧的画面。
- **改变用户相机状态**：全程未保存/恢复相机。正常完成时相机停留在最后一幅的范围；中途抛错也没有恢复机制，用户视图被永久改变。

此外，该方法对行列数只做下限钳制，不设上限，可能因不受约束的分幅数量创建大量图像并占用内存。

本特性将网格出图改为具备清晰状态与异常恢复的流程：保存相机与相关场景设置，逐块设置视图、请求渲染、等待渲染完成信号后采集，最后在 `finally` 中恢复；并校验参数、设置批量上限。

范围决策（待确认）：

- **保持公共入口形状**：保留 `captureGrid(context, options)`、`SceneController.captureGrid()`、`subdivideExtent()` 与 `ShotGridOptions` / `ShotGridShot` 既有形状，通过新增可选字段扩展。
- **不改变 `delayMs` 语义方向**：`delayMs` 仍表示每幅之间的额外等待，默认 `0`，但采集时机改为渲染完成后。

## Glossary

- **Grid Shot（分幅出图）**：将目标范围按行列均分后逐块导出图片的过程。
- **Cell（子范围）**：`subdivideExtent()` 拆分出的一个经纬度子范围 `[west, south, east, north]`。
- **Render Completion Signal（渲染完成信号）**：表示与当前视图对应的帧已经提交到画布的信号。
- **Camera State（相机状态）**：相机的经纬高位置与 heading / pitch / roll 朝向。
- **Scene Setting（场景设置）**：出图过程中被临时修改、需要恢复的渲染相关设置，例如 `scene.requestRenderMode`。
- **Shot Limit（分幅上限）**：单次 `captureGrid` 允许创建的最大图像数量。

## Requirements

### Requirement 1: 相机与场景状态恢复

**User Story:** AS 使用批量出图的开发者, I want 出图结束后相机与场景设置回到出图前, so that 出图不影响用户当前视图。

#### Acceptance Criteria

1. WHEN `captureGrid()` 开始执行, THE 该方法 SHALL 在任何相机变更前保存当前 Camera State 与相关 Scene Setting。
2. WHEN `captureGrid()` 结束（正常返回或抛出异常）, THE 该方法 SHALL 恢复出图前保存的 Camera State 与 Scene Setting。
3. THE 恢复动作 SHALL 在 `finally` 语义下执行，即渲染等待或采集抛错时同样恢复。
4. IF 恢复目标相机在出图期间被外部销毁, THEN THE 该方法 SHALL 在恢复时跳过写入已失效的 viewer，并保持原始异常或结果。

### Requirement 2: 渲染完成后再采集

**User Story:** AS 使用批量出图的开发者, I want 每幅图像对应当前设置的范围, so that 导出的图片内容与目标范围一致。

#### Acceptance Criteria

1. WHEN 为某 Cell 设置相机视图后, THE 该方法 SHALL 请求一帧渲染。
2. WHEN 请求渲染后, THE 该方法 SHALL 等待 Render Completion Signal 再执行采集。
3. WHEN 存在 Render Completion Signal 能力时, THE 采集动作 SHALL 在该信号之后读取画布数据。
4. WHERE 提供 `delayMs > 0`, THE 该方法 SHALL 在等待渲染完成后追加等待 `delayMs` 毫秒。
5. WHILE 等待渲染完成, THE 该方法 SHALL 在超过 `renderTimeoutMs` 后结束等待并采集，以避免无限阻塞。

### Requirement 3: 参数校验与批量上限

**User Story:** AS 使用批量出图的开发者, I want 明确的参数约束, so that 我能避免无效或超量的出图请求。

#### Acceptance Criteria

1. WHEN `rows` 或 `columns` 不是大于等于 1 的整数, THE `captureGrid()` SHALL 抛出 `Arc3DError`，错误码为 `INVALID_ARGUMENT`。
2. WHEN `rows × columns` 超过 Shot Limit, THE `captureGrid()` SHALL 抛出 `Arc3DError`，错误码为 `INVALID_ARGUMENT`。
3. WHERE 未提供 `maxShots`, THE `captureGrid()` SHALL 使用默认 Shot Limit。
4. WHEN 参数校验失败, THE `captureGrid()` SHALL 在修改相机前抛出，不产生任何相机变更。

### Requirement 4: 结果与错误契约

**User Story:** AS 使用批量出图的开发者, I want 结果与错误保持既有契约, so that 现有调用无需改动。

#### Acceptance Criteria

1. WHEN 出图成功, THE `captureGrid()` SHALL 按行优先顺序返回每幅的 `ShotGridShot`，含 `row`、`column`、`extent`、`image`。
2. IF viewer 不暴露可采集画布, THEN THE `captureGrid()` SHALL 抛出 `Arc3DError`，错误码为 `UNSUPPORTED_CAPABILITY`。
3. THE 图像格式 SHALL 由 `format` 决定，默认 `image/png`。

### Requirement 5: 验证

**User Story:** AS SDK 维护者, I want 出图流程可被自动验证, so that 回归可被检测。

#### Acceptance Criteria

1. THE 测试 SHALL 断言每个 Cell 均触发一次渲染请求与一次采集。
2. THE 测试 SHALL 断言出图后相机恢复到出图前状态（正常与异常路径）。
3. THE 测试 SHALL 覆盖 `rows` / `columns` 非法、超过 Shot Limit、viewer 无画布等错误路径。
4. THE 测试 SHALL 覆盖 `delayMs` 追加等待与 `renderTimeoutMs` 兜底路径。

## Decisions

以下问题已确认：

1. **渲染完成信号**：`setView` 后调用 `viewer.render()` 强制同步渲染一帧；当 `scene.postRender` 可监听时，注册一次性监听并在随后 `requestRender` 触发的帧上等待其一帧信号，超过 `renderTimeoutMs` 兜底返回；缺失该能力时立即采集。
2. **批量上限**：新增 `maxShots` 选项，默认 `64`；`rows × columns > maxShots` 时抛 `INVALID_ARGUMENT`（不钳制）。
3. **非法行列数**：`rows` / `columns` 非整数或 `< 1` 时抛 `INVALID_ARGUMENT`（替代原 `Math.max(1, floor)` 钳制）。
