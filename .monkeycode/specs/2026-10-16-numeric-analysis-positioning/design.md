# Design Document

## Overview

采用**非破坏性补齐**：不改变任何既有字段的语义、取值与返回结构，只新增只读描述字段（计算模型、地形来源/状态、土方状态）并补齐文档与退化输入测试。全部改动为新增，`mode` 等既有 `mode`/`units`/`heightDatum`/`reference` 保持不变。

## Components and Interfaces

### 计算模型描述（`units.ts`）

新增枚举与字段：

```ts
/** 数值计算模型，用于说明结果的近似性质与适用范围。 */
export type ComputationModel =
  | "ecef-chord"      // 地心直角坐标三维弦长，含地球曲率，非椭球测地线
  | "spherical"       // 半径取 WGS84 长半轴的球面近似
  | "local-planar"    // 以原点固定 cos(lat) 的局部东-北平面近似
  | "ellipsoid-delta" // 椭球高差

export interface LengthResult { /* 既有字段不变 */ model: ComputationModel }
export interface AreaResult   { /* 既有字段不变 */ model: ComputationModel }
export interface HeightResult { /* 既有字段不变 */ model: ComputationModel }
```

映射规则（在 `index.ts` 的各测量入口赋值）：

| 入口 | 既有 `mode` | 新增 `model` |
| --- | --- | --- |
| `distance` | `cartesian` | `ecef-chord` |
| `horizontalDistance` | `geodesic` | `spherical` |
| `projectedDistance` | `geodesic` | `spherical` |
| `surfaceDistance` | `geodesic` | `spherical` |
| `area(mode)` | `geodesic` / `planar` | `spherical` / `local-planar` |
| `triangleArea` | `geodesic`（隐含） | `spherical` |
| `height` / `verticalDistance` | — | `ellipsoid-delta` |

`model` 由 `mode` 派生，避免第二处真值来源：新增内部辅助 `modelForDistance(mode)` / `modelForArea(mode)`，所有入口统一经其赋值。

### 地形剖面来源与状态（`terrain.ts`）

`ProfilePoint` 扩展为携带采样元数据：

```ts
export interface ProfilePoint extends LngLatHeight {
  distance: number
  source: TerrainHeightSource
  status: TerrainSampleStatus
}
```

`profile()` 的两条路径统一补字段：

- 单点退化路径：`{ ...only, distance: 0 }`（`only` 为 `HeightSample`，已含 `source` / `status`）。
- 多点路径：`sampled.map(...)` 时把 `item.source` / `item.status` 一并拷入。

`terrain.sampleHeight()` / `slope()` 已在结果中带 `source` / `status`，无需改动。

### 土方状态（`volume.ts`）

```ts
/** 土方计算状态。 */
export type CutFillStatus = "computed" | "invalid-polygon" | "empty-grid"

export interface CutFillResult {
  /* 既有字段不变 */
  status: CutFillStatus
}
```

`cutFill()` 三个返回分支分别赋值：`ring.length < 3` → `invalid-polygon`；`grid.cells.length === 0` → `empty-grid`；正常 → `computed`。零值形态与当前保持一致。

### 文档（`docs/architecture/09-analysis.md`）

在「体积」段之后新增「计算模型与适用边界」小节，说明：

- 球面近似：`"spherical"` 使用半径 `WGS84_A` 的球面公式；相对椭球量的相对误差通常在小数百分点量级、随纬度增大，且不含大地线方向修正。
- 局部平面近似：`"local-planar"` 固定原点 `cos(lat)`；仅适用于原点附近、非极区的小范围；高纬/大范围经向拉伸、近极点经度退化。
- ECEF 弦长：`"ecef-chord"` 为两点三维直线距离，含曲率效应，非地表最短路径。
- 椭球高差：`heightDatum: "ellipsoid"`，仅椭球高；缺失高度按 0；剖面/采样点以 `source` / `status` 标识回退与不可用。
- `estimatedErrorCubicMeters` 为边界单元经验量级指标，非数学上界。

同时在 `geometry.ts` / `buffer.ts` / `cutfill.ts` 的受影响函数 JSDoc 中注明所属模型与边界。

### 退化输入（无代码改动，补测试）

现有实现已能处理：`parsePosition` 拒绝非有限/越界；`polygonAreaSquareMeters` 对 `<3` 顶点返回 0；`bufferPolyline` 对零长度段跳过并对不足两点的输入抛 `INVALID_ARGUMENT`。设计不改运行时，只补单元测试固化，确保退化输入返回有限值或稳定错误码。

## Testing Strategy

- `tests/unit/analysis-measure-tools.test.ts` / `analysis-measure.test.ts` / `analysis-task-services.test.ts`：断言各测量入口的 `model` 映射；既有断言按新增字段更新。
- `tests/unit/analysis-terrain.test.ts`：断言剖面点带 `source` / `status`，并覆盖 `unavailable` 场景（构造 `globe.getHeight` 返回 `undefined` 的假 viewer）。
- `tests/unit/analysis-volume.test.ts` / `analysis-cutfill.test.ts`：断言三种 `status`，并锁定非 `computed` 时的零值形态。
- 退化输入用例：空数组、单点、重复顶点、共线环、零长度段，断言无 `NaN`。
- 运行 `npx vitest run` 指定文件，再跑全量 `npm test` 与门禁。

## Risks and Mitigations

- **新增字段被既有断言视为多余键**：逐一更新受影响的 `toEqual` 断言，保持其余字段不变。
- **`model` 与 `mode` 语义混淆**：`mode` 保留为调用者选择的算法模式，`model` 为实际数值模型；文档明确二者关系。
- **公开 API 清单变化**：`ComputationModel` / `CutFillStatus` 为新增导出，执行 `node scripts/release-gate.mjs exports:update` 刷新 `scripts/public-api-manifest.json`。
- **行为差异风险**：本次为纯新增与文档，非法多边形仍返回零值结果，不改变任何现有返回值形态。
