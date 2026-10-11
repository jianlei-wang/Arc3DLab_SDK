# Requirements Document

## Introduction

旧版 `LarkExplorer-SDK`（v1.2.0，基于 CesiumJS 1.118.2，约 60 个功能模块）沉淀了大量二三维 WebGIS 业务能力：空间分析、天气与粒子特效、军事态势标绘、动态图形、体素可视化、多屏联动、坐标转换与网络服务等。当前 `Arc3DLab SDK` 采用契约优先的模块化架构（能力注册、诊断快照、插件作用域、统一分析任务、空间语义合同），已完成运行时、相机、场景、影像地形、图层、图形、交互、分析与后处理的基础能力。

本特性将 `LarkExplorer-SDK` 的全部能力按其语义迁移到 `Arc3DLab SDK`，遵循现有设计标准与规则：以契约优先方式对外暴露，注册能力，纳入诊断与生命周期，需要计算的场景统一走 `AnalysisTask`/`AnalysisResult`，交互类工具纳入工具状态机，涉及外部网络与 UI 的能力分别以可注入 provider 与 UI 组件形式提供。

范围决策（已确认）：

- **全量分阶段迁移**：覆盖旧 SDK 全部能力，按阶段推进。
- **外部依赖纳入**：`WebApi`（高德路线 / POI / 地理编码）与 `NavigationBar` 组件均纳入；网络类以可选 provider 提供，不硬编码密钥。
- **不重新导出 Cesium**：保持当前规则，消费者仍从 `cesium` 导入；新能力只封装行为。

## Glossary

- **Arc3DApp**：`Arc3D.create()` 解析后得到的运行时门面，聚合各 Manager。
- **Capability（能力）**：由 `CapabilityRegistry` 声明的、可由引擎后端回报可用性的功能标识，形如 `analysis:buffer`。
- **AnalysisTask（分析任务）**：统一异步分析合同，含任务 ID、状态、进度、取消、输入快照、结果与产物。
- **AnalysisResult（分析结果）**：分析任务的结构化输出，含状态、数据、单位、警告与产物。
- **ToolState（工具状态机）**：交互工具的 `idle / deactivating / activating / active` 状态。
- **Plotting（态势标绘）**：军事 / 战术标号绘制能力，包含点、线、面与箭头族符号。
- **Provider（提供者）**：可注入的外部服务抽象，消费者提供实现（如高德 Web 服务）。
- **SpatialReference（空间参考）**：描述坐标参考系、轴顺序、单位与高程基准的语义对象。
- **Legacy Adapter（兼容适配器）**：面向旧版 `Map` API 形状的迁移层。
- **Stage（后处理阶段）**：Cesium `PostProcessStage` 封装，用于天气与水面等全屏特效。
- **Voxel（体素）**：按网格采样并插值的三维标量场可视化。
- **Diagnostics（诊断）**：只读运行时快照，覆盖生命周期、资源计数、监听数、活动工具、插件与待处理任务。

## Requirements

### Requirement 1: 旧版兼容适配器

**User Story:** AS 迁移自 LarkExplorer 的开发者, I want 使用接近旧版 `Map` 的入口与名称, so that 既有业务代码可以低成本迁移到新 SDK。

#### Acceptance Criteria

1. WHEN 开发者调用兼容入口创建场景, THE SDK SHALL 暴露涵盖图层、地形、交互、导航、天气、组件、空间分析、态势标绘、场景窗口与渲染事件的 Manager 集合。
2. WHILE 通过兼容入口使用, THE SDK SHALL 复用 `Arc3DApp` 的运行时、生命周期与诊断能力。
3. IF 兼容入口使用了当前 SDK 未提供的旧方法, THE SDK SHALL 抛出带稳定错误码的 `Arc3DError`。
4. WHEN 兼容对象被销毁, THE SDK SHALL 释放其注册的所有监听、图元与资源。

### Requirement 2: 坐标与几何工具

**User Story:** AS GIS 开发者, I want 屏幕坐标、笛卡尔坐标与经纬度之间的转换与几何计算工具, so that 我可以实现拾取、量测与标绘等业务。

#### Acceptance Criteria

1. WHEN 提供屏幕像素坐标与场景, THE SDK SHALL 返回地表交点对应的笛卡尔坐标与 WGS84 坐标。
2. WHEN 提供经纬度或笛卡尔坐标, THE SDK SHALL 在 WGS84、笛卡尔与制图（Cartographic）表示之间双向转换。
3. WHEN 提供折线节点与缓冲距离, THE SDK SHALL 返回按指定步长插值的中间点集合。
4. WHEN 提供多边形节点, THE SDK SHALL 返回其质心与四至范围。
5. WHEN 提供起点、方位角与距离, THE SDK SHALL 返回按大地线计算的目标点坐标。
6. WHEN 提供位置与地形服务, THE SDK SHALL 异步返回采样高程，并对无地形数据的位置返回显式空值。

### Requirement 3: 屏幕事件与拾取服务

**User Story:** AS 交互开发者, I want 绑定鼠标与触摸事件并拾取场景对象, so that 我可以实现自定义交互。

#### Acceptance Criteria

1. WHEN 开发者注册事件监听, THE SDK SHALL 支持左键、右键、中键、滚轮、移动、双击与捏合的按下/抬起/单击事件类型。
2. WHEN 开启全局对象拾取, THE SDK SHALL 对矢量数据与影像服务数据返回命中的对象集合。
3. WHEN 开启坐标拾取, THE SDK SHALL 在左键单击时返回命中的笛卡尔坐标与经纬度坐标。
4. WHILE 鼠标跟随提示开启, THE SDK SHALL 在指针移动时更新提示内容与位置。
5. WHEN 开发者注销事件监听, THE SDK SHALL 释放对应的 `ScreenSpaceEventHandler` 并恢复默认鼠标样式。

### Requirement 4: 相机与导航扩展

**User Story:** AS 场景开发者, I want 按四至、对象、坐标与绕点方式控制相机, so that 我可以实现视角切换与巡视动画。

#### Acceptance Criteria

1. WHEN 提供四至范围 `[west, south, east, north]`, THE SDK SHALL 在指定时长内将相机飞行到对应范围。
2. WHEN 提供场景对象, THE SDK SHALL 将相机飞行或直接定位到该对象的包围范围。
3. WHEN 提供经纬度坐标与朝向, THE SDK SHALL 将相机飞行或定位到该坐标。
4. WHEN 提供目标点、俯仰角、旋转周期与距离, THE SDK SHALL 以目标点为中心持续环绕旋转，并可停止。
5. WHILE 相机处于初始视角集合内, THE SDK SHALL 支持读取与设置初始视角。
6. WHEN 读取比例尺或视域, THE SDK SHALL 返回每像素地面距离与当前视域四至。
7. WHEN 提供路径点集合, THE SDK SHALL 以第一人称方式沿路径播放漫游动画，并支持暂停、继续与清除。

### Requirement 5: 交互式量测工具

**User Story:** AS 场景使用者, I want 在地图上交互式量测距离、面积、高差、方位角、坡角、三角与体积, so that 我可以分析目标空间属性。

#### Acceptance Criteria

1. WHEN 激活距离量测并指定类型, THE SDK SHALL 支持空间距离、投影距离、地表距离与椭球距离四类量测并返回结果。
2. WHEN 激活面积量测, THE SDK SHALL 支持投影面积与地表面积并在绘制完成后返回结果。
3. WHEN 激活高差、方位角、坡角或三角量测, THE SDK SHALL 在完成取点后返回对应数值。
4. WHEN 激活体积量测并指定基准面与参数, THE SDK SHALL 返回挖方与填方体积。
5. WHILE 量测工具处于激活状态, THE SDK SHALL 显示绘制引导并允许退出激活。
6. WHEN 开发者调用清除, THE SDK SHALL 移除全部量测图元且不影响其它工具。

### Requirement 6: 缓冲区分析

**User Story:** AS 分析开发者, I want 对点、线与面构造缓冲区, so that 我可以进行邻域分析。

#### Acceptance Criteria

1. WHEN 提供点坐标与半径, THE SDK SHALL 返回以该点为圆心、按大地线计算的缓冲多边形顶点集合。
2. WHEN 提供折线节点与距离, THE SDK SHALL 返回该折线的缓冲多边形顶点集合。
3. WHEN 提供多边形节点与距离, THE SDK SHALL 返回该多边形的外扩或内缩缓冲顶点集合。
4. WHEN 输入为笛卡尔坐标, THE SDK SHALL 先转换为 WGS84 再计算，并返回 WGS84 顶点。
5. WHEN 输入半径或距离非正数, THE SDK SHALL 返回带稳定错误码的 `Arc3DError`。

### Requirement 7: 卷帘对比

**User Story:** AS 场景使用者, I want 通过可拖动分隔条对比两幅影像, so that 我可以评估不同时相或方案差异。

#### Acceptance Criteria

1. WHEN 开启卷帘, THE SDK SHALL 叠加上对比影像并显示可拖动分隔条。
2. WHEN 拖动分隔条或捏合, THE SDK SHALL 同步更新场景分割位置。
3. WHEN 设置对比方向, THE SDK SHALL 支持左侧对比与右侧对比两种方向。
4. WHEN 更换对比影像, THE SDK SHALL 移除旧对比影像并载入新影像。
5. WHEN 关闭卷帘或销毁, THE SDK SHALL 移除对比影像、分隔条 DOM 与事件监听。

### Requirement 8: 路径分析与路线展示

**User Story:** AS 导航业务开发者, I want 展示路径规划结果并按路况着色, so that 我可以直观呈现出行方案。

#### Acceptance Criteria

1. WHEN 提供含路况分段的路径结果, THE SDK SHALL 按路况等级用不同颜色绘制贴地路径线。
2. WHEN 开启标注, THE SDK SHALL 在路径中部标注总距离与总用时。
3. WHEN 切换显示状态, THE SDK SHALL 同时控制路径线与标注的显隐。
4. WHEN 销毁路径对象, THE SDK SHALL 移除路径图元与标注并释放引用。

### Requirement 9: 热力图分析

**User Story:** AS 分析开发者, I want 绘制二维与三维热力图, so that 我可以呈现点数据的空间聚集。

#### Acceptance Criteria

1. WHEN 提供带权重的点位数据与类型, THE SDK SHALL 在二维模式绘制贴地热力面，在三维模式绘制拉伸体。
2. WHEN 指定半径、渐变色与基础高度, THE SDK SHALL 按参数渲染热力效果。
3. WHEN 在二维与三维模式之间切换, THE SDK SHALL 复用已计算结果并更新显示。
4. WHEN 更新数据集合, THE SDK SHALL 重新计算并刷新渲染。
5. WHEN 销毁热力图, THE SDK SHALL 移除图元、DOM 与内部实例。

### Requirement 10: 动态热力图

**User Story:** AS 可视化开发者, I want 让热力图随时间动态变化, so that 我可以呈现时变聚集过程。

#### Acceptance Criteria

1. WHEN 提供时间序列数据与参数, THE SDK SHALL 生成随时间演化的热力纹理并贴地渲染。
2. WHEN 更新噪声值或纹理, THE SDK SHALL 在不重建场景的前提下刷新效果。
3. WHEN 销毁动态热力图, THE SDK SHALL 释放纹理、图元与动画监听。

### Requirement 11: 洪水淹没分析

**User Story:** AS 分析开发者, I want 在指定区域模拟水面淹没效果, so that 我可以演示内涝与水位场景。

#### Acceptance Criteria

1. WHEN 提供淹没区域与水面状态参数, THE SDK SHALL 叠加可交互的水面渲染效果。
2. WHEN 调整水位或水面位置, THE SDK SHALL 更新水面高度并保持区域裁剪。
3. WHEN 关闭或销毁洪水效果, THE SDK SHALL 移除着色器程序、纹理与图元。

### Requirement 12: 天气特效

**User Story:** AS 场景开发者, I want 呈现雨、雪、雾、雷电天气, so that 我可以增强场景表现力。

#### Acceptance Criteria

1. WHEN 开启任一天气特效, THE SDK SHALL 通过全屏后处理阶段渲染对应效果。
2. WHEN 调整天气参数（如雨的倾斜角、大小、速度）, THE SDK SHALL 实时更新效果参数。
3. WHEN 同时开启多种天气特效, THE SDK SHALL 保持各效果独立且可分别关闭。
4. WHEN 关闭或销毁天气特效, THE SDK SHALL 移除对应后处理阶段并释放着色器资源。

### Requirement 13: 粒子特效

**User Story:** AS 场景开发者, I want 呈现火焰、水枪与爆炸等粒子效果, so that 我可以表现动态现象。

#### Acceptance Criteria

1. WHEN 在指定位置创建火焰效果并选择类型, THE SDK SHALL 渲染带相应发射器与大小的粒子。
2. WHEN 提供源点、目标点与参数（角度、重力）, THE SDK SHALL 渲染水枪喷射效果并支持参数调整。
3. WHEN 触发爆炸效果, THE SDK SHALL 在指定位置渲染一次性爆炸粒子。
4. WHEN 销毁粒子效果, THE SDK SHALL 移除实体、监听与相关资源。

### Requirement 14: 动态图形与符号

**User Story:** AS 场景开发者, I want 创建扩散点、雷达、水系、圆扩散、动态折线、热点面板与广告牌, so that 我可以构建丰富的动态图层。

#### Acceptance Criteria

1. WHEN 提供位置、半径与样式, THE SDK SHALL 创建带扩散动画的点符号。
2. WHEN 提供中心点与扫描半径, THE SDK SHALL 创建雷达扫描符号。
3. WHEN 提供边界节点, THE SDK SHALL 创建带动态水纹材质的水系面。
4. WHEN 提供中心点与参数, THE SDK SHALL 创建圆形扩散动画对象并支持启停。
5. WHEN 提供节点集合与速度参数, THE SDK SHALL 创建按时间移动的动态折线。
6. WHEN 提供位置与文本内容, THE SDK SHALL 创建随视距显隐的热点面板。
7. WHEN 销毁动态图形, THE SDK SHALL 移除图元与动画监听。

### Requirement 15: 军事态势标绘

**User Story:** AS 态势标绘开发者, I want 绘制点、线、面与箭头族军事符号, so that 我可以进行战术标图。

#### Acceptance Criteria

1. WHEN 调用任一标绘方法并提供参数, THE SDK SHALL 进入交互绘制流程并在完成后返回实体结果。
2. WHEN 绘制符号, THE SDK SHALL 支持点、广告牌、折线、曲线、自由线、多边形、自由多边形、正多边形、弓形、椭圆、扇形、圆、矩形、圆角矩形、集结地、直线箭头、直角箭头、直箭头、攻击箭头、燕尾箭头、钳击箭头、旗帜、队号与标签共 24 类符号。
3. WHEN 指定样式参数, THE SDK SHALL 按参数渲染符号的外观（颜色、线宽、填充、图标等）。
4. WHEN 绘制完成, THE SDK SHALL 将结果统一登记到标绘结果集合，便于按 ID 检索与批量移除。
5. WHEN 调用移除方法, THE SDK SHALL 支持移除单个、按 ID 或全部标绘结果。
6. WHILE 标绘工具激活, THE SDK SHALL 遵循工具状态机并保证激活与退出的一致性。

### Requirement 16: 地形开挖

**User Story:** AS 场景开发者, I want 对指定多边形区域开挖并显示井壁, so that 我可以展示地下结构。

#### Acceptance Criteria

1. WHEN 提供开挖区域与深度, THE SDK SHALL 裁剪该区域地形并生成井壁与底面。
2. WHEN 更新开挖参数, THE SDK SHALL 重建裁剪与井壁几何。
3. WHEN 移除单个或全部开挖, THE SDK SHALL 恢复地形并释放相关图元。

### Requirement 17: 体素可视化

**User Story:** AS 科研与可视化开发者, I want 以体素方式呈现三维标量场, so that 我可以分析体数据分布。

#### Acceptance Criteria

1. WHEN 提供点数据与体素参数, THE SDK SHALL 生成体素盒并根据数值着色。
2. WHEN 提供插值查询坐标, THE SDK SHALL 返回按配置插值的数值。
3. WHEN 异步请求数据, THE SDK SHALL 返回可增量更新的数据集合。
4. WHEN 销毁体素对象, THE SDK SHALL 释放图元、纹理与着色器。

### Requirement 18: 模型压平

**User Story:** AS 场景开发者, I want 将模型与指定多边形范围压平, so that 我可以处理建设场地。

#### Acceptance Criteria

1. WHEN 提供模型与压平多边形, THE SDK SHALL 在模型上应用压平效果。
2. WHEN 添加或更新压平多边形, THE SDK SHALL 合并多个区域并刷新效果。
3. WHEN 切换启用状态, THE SDK SHALL 控制压平效果显隐。
4. WHEN 清除或销毁, THE SDK SHALL 移除压平效果并释放着色器资源。

### Requirement 19: 材质与动画

**User Story:** AS 视觉开发者, I want 使用动态扩散与线尾迹材质, so that 我可以实现扫描与流动效果。

#### Acceptance Criteria

1. WHEN 将动态扩散材质应用于图形并指定颜色、周期与渐变, THE SDK SHALL 按时间计算材质值。
2. WHEN 将线尾迹材质应用于折线并指定颜色、图标与周期, THE SDK SHALL 按时间计算流动贴图。
3. WHEN 修改材质参数, THE SDK SHALL 触发 `definitionChanged` 并刷新渲染。
4. WHEN 相同参数的材质比较, THE SDK SHALL 返回相等判定。

### Requirement 20: 多屏联动与场景出图

**User Story:** AS 场景开发者, I want 让多个场景相机联动并导出网格出图, so that 我可以进行对比观察与成果输出。

#### Acceptance Criteria

1. WHEN 提供多个场景对象, THE SDK SHALL 创建多屏联动对象并保持相机同步。
2. WHEN 结束联动, THE SDK SHALL 释放联动监听。
3. WHEN 请求网格出图, THE SDK SHALL 按网格分幅导出场景图片集合。

### Requirement 21: NavigationBar 组件

**User Story:** AS 应用开发者, I want 使用内置导航条组件, so that 我可以提供放大、缩小、复位、俯视与二维三维切换操作。

#### Acceptance Criteria

1. WHEN 挂载导航条, THE SDK SHALL 在场景容器内渲染可交互的导航控件。
2. WHEN 点击各控件, THE SDK SHALL 执行对应的相机或场景模式操作。
3. WHEN 卸载导航条, THE SDK SHALL 移除 DOM 与事件监听并释放资源。

### Requirement 22: Web 服务提供者

**User Story:** AS 业务开发者, I want 通过可注入 provider 调用路径规划、POI 检索与地理编码, so that 我可以接入外部数据服务。

#### Acceptance Criteria

1. WHEN 注入提供者实现与凭据, THE SDK SHALL 通过统一接口执行驾车路径规划并返回含路况分段的结果。
2. WHEN 注入提供者实现, THE SDK SHALL 支持关键字 POI 检索与地址地理编码、逆地理编码。
3. WHEN 未注入提供者, THE SDK SHALL 返回带稳定错误码的 `Arc3DError`。
4. WHEN 未配置凭据, THE SDK SHALL 拒绝发起请求并提示缺少凭据。
5. WHEN 可选地将返回坐标接入场景, THE SDK SHALL 提供 GCJ-02 与 WGS84 之间的转换工具。

### Requirement 23: 域名数据与高亮语义

**User Story:** AS 业务开发者, I want 使用行政区划数据与图层高亮特效, so that 我可以快速构建业务界面。

#### Acceptance Criteria

1. WHEN 导入中国行政区划数据, THE SDK SHALL 按省市区三级提供区域与编码数据。
2. WHEN 对实体图层开启高亮, THE SDK SHALL 支持呼吸灯、缩放闪烁与跳跃三类高亮效果。
3. WHEN 关闭高亮, THE SDK SHALL 恢复图层原始样式。

### Requirement 24: 公共 API、文档与质量门禁

**User Story:** AS 维护者, I want 迁移能力具备一致的公共 API、文档与自动化验证, so that 我可以保证质量与可维护性。

#### Acceptance Criteria

1. WHEN 新增能力对外发布, THE SDK SHALL 通过根入口与 `@arc3dlab/sdk` 提供具名导出与类型，且公共符号具备中文 TSDoc。
2. WHEN 新增能力依赖引擎后端, THE SDK SHALL 在 `CapabilityRegistry` 声明对应能力并由引擎回报可用性。
3. WHEN 新增能力注册资源或监听, THE SDK SHALL 纳入诊断快照并在销毁后归零。
4. WHEN 新增分析类能力, THE SDK SHALL 提供统一任务化方法并返回 `AnalysisResult`。
5. WHEN 迁移代码合入, THE SDK SHALL 通过 `gate`（类型检查、测试、依赖 / 导出 / 许可证 / API / 文档 / 格式）与浏览器 E2E 关键路径。
6. WHEN 能力对消费者可见, THE SDK SHALL 在开发指南站与 API 文档站补充对应章节。
