# Requirements Document

## Introduction

`@arc3dlab/analysis` 提供测量、地形、体积等数值分析能力。当前结果类型只记录「算法模式」（`mode: "cartesian" | "geodesic"`、`AreaMode`），不说明该模式背后的**数值模型**及其近似性质，于是出现如下定位模糊：

- `geodesicDistanceMeters()`（`geometry.ts`）与 `geodesicRingArea()`（`geometry.ts`）实为「半径取 WGS84 长半轴的球面公式」，却被命名为 `geodesic`；`DistanceMode` / `AreaMode: "geodesic"` 因此让调用者误以为结果是 WGS84 椭球精确测地线量。
- `toLocalMeters()` / `fromLocalMeters()`（`geometry.ts`）把经度缩放系数 `cos(lat)` 固定在投影原点，仅在小范围、非极区有效；`buffer*`、`cutFill` 网格、`planarRingArea()` 与点到线段距离都建立在该局部平面上。高纬、大范围或近极点时误差显著，但类型与文档未标出适用边界。
- `terrain.profile()`（`terrain.ts`）返回的 `ProfilePoint` 丢弃了地形采样的 `source` / `status`，地形不可用（高程回退为 0 米）与真实 0 米无法区分。
- `VolumeAnalysis.cutFill()`（`volume.ts`）在顶点少于 3 或网格为空时静默返回全 0 结果，调用者无法区分「地形平坦、体积为 0」与「多边形非法」；`estimatedErrorCubicMeters` 为经验性量级指标，未声明并非数学误差上界。

本特性**不改动现有字段语义与返回结构**，仅新增只读描述字段与文档，让每个数值结果显式携带其计算模型、近似性质与适用边界，并让地形剖面与土方结果携带可识别的状态。近似算法本身保留。

## Glossary

- **计算模型（computation model）**：产生结果所依据的数值模型，描述精度定位，例如球面近似、局部东-北平面近似、地心弦长、椭球高差。
- **局部平面近似**：以某原点把经纬度投影为东向/北向米制坐标，`cos(lat)` 固定于原点，仅在原点附近小范围内有效。
- **球面近似**：以半径 `WGS84_A` 的球面公式代替 WGS84 椭球量，误差随纬度与跨度增大。
- **地形采样状态**：`TerrainSampleStatus`，`sampled` / `fallback` / `unavailable` / `cancelled`。

## Requirements

### Requirement 1: 测量结果携带计算模型

**User Story:** AS SDK 使用者, I want 长度/面积/高度结果标注其计算模型, so that 我能判断结果属于精确量还是近似量及其适用边界。

#### Acceptance Criteria

1. WHEN 构造 `LengthResult`, THE `LengthResult` SHALL 携带只读字段 `model: ComputationModel`，取值由实际算法决定：ECEF 三维弦长为 `"ecef-chord"`，球面公式为 `"spherical"`。
2. WHEN 构造 `AreaResult`, THE `AreaResult` SHALL 携带只读字段 `model: ComputationModel`，`mode: "geodesic"` 对应 `"spherical"`，`mode: "planar"` 对应 `"local-planar"`。
3. WHEN 构造 `HeightResult`, THE `HeightResult` SHALL 携带只读字段 `model: ComputationModel`，取值为 `"ellipsoid-delta"`。
4. WHEN 查询 `ComputationModel` 类型, THE 类型 SHALL 至少包含 `"ecef-chord"` / `"spherical"` / `"local-planar"` / `"ellipsoid-delta"` 四种取值。
5. WHEN 结果携带 `model`, THE 既有字段 `mode` / `units` / `heightDatum` / `reference` SHALL 保持原语义与取值不变。
6. WHEN 调用 `@arc3dlab/analysis` 的全部测量入口（`distance` / `horizontalDistance` / `projectedDistance` / `surfaceDistance` / `area` / `triangleArea` / `height` / `verticalDistance` 及其 `*Task` 变体）, THE 返回结果的 `model` SHALL 与上述映射一致。

### Requirement 2: 地形剖面携带来源与状态

**User Story:** AS SDK 使用者, I want 地形剖面的每个采样点标注高程来源与状态, so that 我能区分真实高程与地形不可用时的回退值。

#### Acceptance Criteria

1. WHEN 构造 `ProfilePoint`, THE `ProfilePoint` SHALL 携带只读字段 `source: TerrainHeightSource` 与 `status: TerrainSampleStatus`。
2. WHEN 执行 `terrain.profile()`（含单点退化路径与多段路径）, THE 返回的每个 `ProfilePoint` SHALL 使用底层 `sampleCartographics()` 的同名 `source` / `status`，语义与 `terrain.sampleHeight()` 一致。
3. WHEN 地形不可用, THE 对应剖面点 SHALL 以 `status: "unavailable"` 与 `source: "ellipsoid"` 标识，而非仅表现为高程 0 米。
4. WHEN `terrain.profile()` 输出经过 `profileTask()`, THE 结果值中的每个点 SHALL 保持相同的 `source` / `status`。

### Requirement 3: 土方结果携带状态

**User Story:** AS SDK 使用者, I want 土方计算结果标注计算状态, so that 我能区分「体积确实为 0」与「输入多边形非法/网格为空」。

#### Acceptance Criteria

1. WHEN 构造 `CutFillResult`, THE `CutFillResult` SHALL 携带只读字段 `status: CutFillStatus`，取值至少包含 `"computed"` / `"invalid-polygon"` / `"empty-grid"`。
2. WHEN `volume.cutFill()` 的顶点少于 3 个, THE 结果 SHALL 为 `status: "invalid-polygon"`，其余数值字段保持当前的零值形态。
3. WHEN 多边形合法但网格为空, THE 结果 SHALL 为 `status: "empty-grid"`。
4. WHEN 正常完成采样与累计, THE 结果 SHALL 为 `status: "computed"`。
5. WHEN `status` 非 `"computed"`, THE `sampleCount` SHALL 为 0，且 `cutCubicMeters` / `fillCubicMeters` / `estimatedErrorCubicMeters` SHALL 为 0。

### Requirement 4: 近似算法的适用边界与误差含义有据可查

**User Story:** AS SDK 使用者, I want 每个近似算法的适用条件与误差含义被文档化, so that 我能在正确范围内使用，不把经验指标当数学上界。

#### Acceptance Criteria

1. WHEN 查阅 Analysis 架构文档, THE 文档 SHALL 说明球面近似（`"spherical"`）相对 WGS84 椭球量的误差来源与量级，并注明其结果不含大地线方向修正。
2. WHEN 查阅 Analysis 架构文档, THE 文档 SHALL 说明局部平面近似（`"local-planar"`）的适用条件：以单一原点固定 `cos(lat)`，仅适用于原点附近、非极区的小范围，并指出高纬/大范围/近极点的失真方向。
3. WHEN 查阅 Analysis 架构文档, THE 文档 SHALL 说明 `estimatedErrorCubicMeters` 为边界单元经验量级指标，**不是**数学误差上界。
4. WHEN 查阅 Analysis 架构文档, THE 文档 SHALL 说明高程基准仅为椭球高（`heightDatum: "ellipsoid"`），缺失高度按 `MISSING_HEIGHT = 0` 处理，剖面/采样点以 `status` 标识回退与不可用。
5. WHEN 阅读 `geometry.ts` / `buffer.ts` / `cutfill.ts` / `units.ts` 中受影响的公开函数, THE 函数 SHALL 在 JSDoc 中注明其所属计算模型与适用边界。

### Requirement 5: 退化输入不产生 NaN

**User Story:** AS SDK 使用者, I want 退化输入被稳定处理, so that 分析结果不会把 NaN 传播到渲染或后续计算。

#### Acceptance Criteria

1. WHEN 传入空数组、重复顶点、共线环、零长度线段或单点路径, THE 相关分析函数 SHALL 返回有限数值或抛 `Arc3DError("INVALID_ARGUMENT")`，SHALL NOT 返回 `NaN`。
2. WHEN `polygonAreaSquareMeters()` 收到顶点少于 3 的环, THE 返回 SHALL 为有限的 0。
3. WHEN `cutFill()` 收到非法多边形, THE 结果 SHALL 为可识别的 `status` 而非 `NaN` 或未标注的 0。
4. WHEN 上述退化输入被处理, THE 行为 SHALL 以单元测试固化。

## Out of Scope

- 用精确椭圆测地线（Vincenty/Karney）替换现有球面公式。
- 重命名 `DistanceMode` / `AreaMode: "geodesic"` 或其它既有公共字段（保持非破坏）。
- 引入正高 / 大地水准面模型；`HeightDatum` 仍仅支持 `"ellipsoid"`。
- 改变非法多边形时的返回形态（仍返回零值结果，仅新增 `status`）。
