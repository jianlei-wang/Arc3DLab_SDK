# Requirements Document

## Introduction

`@arc3dlab/graphics` 的 `MultiTileVoxel`（`packages/graphics/src/voxel.ts`）对外承诺“将离散点数据插值为体素盒并按数值着色”，但当前实现的核心输出与输入点数据脱节：

- `sampleGrid(x, y, z)` 返回 `(cx + cy + cz) / (dimensions * 3)`，即采样值只由网格索引决定，与 `pointData` 无关；`pointData` 仅参与数值最小/最大值与边界计算。
- `buildPrimitive()` 的垂直跨度使用 `maxValue - minValue`（数值范围）估算几何深度，而实际高程跨度是 `maxZ - minZ`。
- `interpolate()` 把经度、纬度的“度”与高程的“米”直接做欧氏距离，破坏空间位置与体素几何的对应关系。

结果是颜色分布呈现由索引构造的规则梯度，而非真实数据分布。本特性先确立体素数据合同（坐标系统、单位、网格范围、缺失值规则），据此实现采样插值，并用有已知答案的合成数据验证采样结果与边界。

范围决策（待确认）：

- **先定义合同再实现**：本特性先交付需求与设计文档，经确认后实施代码与测试。
- **以空间插值为默认语义**：体素网格每个节点的值来自输入点的空间插值，而非索引派生值。
- **保持公共入口兼容**：保留 `MultiTileVoxel` / `VoxelPoint` / `VoxelOptions` / `app.graphics.addVoxel()` 的既有形状，通过新增可选配置扩展，不破坏现有调用。

## Glossary

- **VoxelPoint（体素点）**：输入离散采样点 `{ x, y, z, value }`。
- **Voxel Grid（体素网格）**：`dimensions³` 个节点的规则三维网格，每个节点携带一个标量采样值。
- **Node（网格节点）**：体素网格中的一个采样位置，由整数索引 `(i, j, k)` 标识。
- **ENU（东-北-天局部坐标系）**：以体素盒中心为原点的局部直角坐标系，单位为米。
- **IDW（反距离加权）**：以到输入点距离的幂次倒数为权重的插值方法。
- **Nearest Neighbor（最近邻）**：取距离最近的输入点值作为采样值的插值方法。
- **Missing Value（缺失值）**：表示某点或某节点无有效数值的标记。
- **Color Domain（颜色定义域）**：参与颜色映射的数值区间 `[min, max]`。

## Requirements

### Requirement 1: 体素数据合同

**User Story:** AS 集成体素可视化的开发者, I want 明确输入点的坐标系统、单位与缺失值规则, so that 我能提供数据并预期可复现的渲染结果。

#### Acceptance Criteria

1. THE `VoxelPoint` SHALL 定义 `x` 为 WGS84 经度（度）、`y` 为 WGS84 纬度（度）、`z` 为相对 WGS84 椭球面的高程（米）。
2. THE `VoxelPoint.value` SHALL 以应用自定义标量单位表达，THE SDK SHALL 仅在颜色映射阶段对其做归一化。
3. WHEN `VoxelPoint.value` 为 `NaN`，THE `MultiTileVoxel` SHALL 将该点视为缺失值，并从边界计算、颜色定义域与插值中排除。
4. THE `docs` 与开发者指南 SHALL 记录坐标系统、单位与缺失值规则。

### Requirement 2: 网格几何与取值范围

**User Story:** AS 集成体素可视化的开发者, I want 体素盒的几何范围与高程跨度正确, so that 体素在空间中的位置与输入点对应。

#### Acceptance Criteria

1. THE `MultiTileVoxel` SHALL 以输入点经度、纬度、高程的最小/最大值计算体素盒的地理边界。
2. THE 垂直跨度 SHALL 等于输入点高程跨度 `maxZ - minZ`。
3. WHEN 某维度跨度为 0，THE `MultiTileVoxel` SHALL 对该维度应用一个正向的最小跨度，以保证体素盒非退化。
4. WHEN 网格节点索引为 `(i, j, k)`，THE 节点地理坐标 SHALL 由索引在 `[0, dimensions - 1]` 区间线性映射到对应边界，使边界由端点节点覆盖。
5. WHERE 提供 `padding` 选项，THE `MultiTileVoxel` SHALL 在各维度两侧按该值（米）扩展体素盒范围。
6. WHERE 未提供 `padding`，THE `MultiTileVoxel` SHALL 使用 `0` 作为默认扩展值。

### Requirement 3: 空间采样与插值

**User Story:** AS 集成体素可视化的开发者, I want 体素值来自输入点的空间插值, so that 颜色分布真实反映数据空间分布。

#### Acceptance Criteria

1. WHEN `requestData()` 为节点生成采样值，THE `MultiTileVoxel` SHALL 基于 `pointData` 计算该值，THE 采样值 SHALL 随输入点数值变化而变化。
2. THE 距离计算 SHALL 在 ENU 局部坐标系中以米为单位进行，其中经度距离按 `cos(centerLat)` 折算。
3. WHERE 插值方法为 `idw`，THE 采样值 SHALL 为各输入点值的加权平均，权重为距离倒数的 `power` 次幂，`power` 默认取 2。
4. WHEN 查询位置与某输入点距离为 0，THE `MultiTileVoxel` SHALL 直接返回该点值。
5. WHERE 插值方法为 `nearest`，THE 采样值 SHALL 为最近输入点的值。
6. WHERE 节点未采集到有效输入点，THE `MultiTileVoxel` SHALL 将该节点标记为缺失并输出透明颜色。
7. THE `MultiTileVoxel.interpolate(x, y, z)` SHALL 使用与网格采样一致的插值方法与距离度量。
8. WHERE 未提供 `method`，THE `MultiTileVoxel` SHALL 使用 `idw`。
9. WHERE 未提供 `power`，THE `MultiTileVoxel` SHALL 使用 `2`。

### Requirement 4: 颜色映射

**User Story:** AS 集成体素可视化的开发者, I want 颜色由真实采样值域映射, so that 颜色刻度表达数据分布。

#### Acceptance Criteria

1. THE Color Domain 的上下界 SHALL 来自有效采样值（排除缺失节点）。
2. WHEN `max` 等于 `min`，THE `MultiTileVoxel` SHALL 将全部有效节点映射到颜色刻度的同一端点。
3. THE `MultiTileVoxel` SHALL 将采样值在 Color Domain 内线性映射到 `colorsList`，且低值端与高值端的映射方向在文档中显式声明。

### Requirement 5: 合成数据验证

**User Story:** AS SDK 维护者, I want 用已知答案的合成数据验证采样与边界, so that 回归可被自动检测。

#### Acceptance Criteria

1. THE 测试 SHALL 使用含已知解析结果的合成数据集，断言指定节点的采样值落在由插值方法计算的期望区间内。
2. THE 测试 SHALL 断言采样值随输入点数值变化而变化，即“采样输出依赖输入数据”。
3. WHEN 输入点为单一常数值，THE 测试 SHALL 断言全部有效节点的采样值等于该常数。
4. THE 测试 SHALL 覆盖高程跨度、零度纬度附近的经度折算、以及缺失值排除。
5. THE 测试 SHALL 覆盖仅支持 0 级瓦片、`dimensions` 边界与空点集等边界条件。

## Decisions

以下问题已确认：

1. **默认插值方法**：默认 `idw`（`power = 2`，距离为 0 时回退该点值），`nearest` 作为 `method` 可选值。
2. **缺失值表示**：以 `value = NaN` 表示缺失；缺失点排除出边界、颜色定义域与插值，节点无有效输入时输出透明颜色。
3. **网格范围与 padding**：网格端点覆盖输入点边界（索引 `[0, dimensions - 1]` 线性映射）；新增 `padding` 选项（默认 `0`，单位米）；零跨度维度使用共享的最小跨度常量。
