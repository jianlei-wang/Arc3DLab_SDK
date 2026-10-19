# Analysis 模块

Updated: 2026-10-19

Analysis 是 Arc3DLab 的核心竞争力域。第一阶段提供测量骨架，后续按 Capability 扩展。

```ts
await app.analysis.measure.distance({ positions })
await app.analysis.measure.area({ positions, holes, mode })
await app.analysis.measure.height({ from, to })
await app.analysis.measure.horizontalDistance({ from, to })
await app.analysis.measure.verticalDistance({ from, to })
await app.analysis.measure.heading({ from, to })
await app.analysis.measure.spaceAngle({ from, via, to })
```

单位约定：长度米、面积平方米、体积立方米、角度度。高程基准为椭球高，缺失高程按 0。

## 统一任务与结果合同（Implemented）

`app.analysis.run(options)` 用统一合同执行分析，任务登记在 `app.analysis.tasks`：

```ts
const result = await app.analysis.run({
  algorithm: "custom-area",
  input: { positions },
  signal,
  onProgress,
  maxSamples,
  execute: (runner) => {
    runner.report(1, 1, "compute")
    return { value: 42, units: { area: "squareMeters" } }
  },
})

result.status // pending | running | succeeded | failed | cancelled
result.value
result.units // { length?, area?, volume?, angle? }
result.artifacts // ResultArtifact[]
```

`AnalysisTask` 记录 `id / algorithm / algorithmVersion / status / createdAt / startedAt / finishedAt / progress / maxSamples / error`。`AnalysisResult` 携带 `units / spatialReference / verticalReference / extent / warnings / confidence / inputSnapshot / source / artifacts`。执行函数抛错不向上传播，转换为 `status: "failed"` 的结果并保留稳定错误码；`signal` 触发为 `cancelled`。`ResultArtifact.kind` 覆盖 `volume / profile / viewshed / sample-grid / report / geometry`。

输入快照合同：任务启动时对 `input` / `params` 生成独立快照（默认经 `structuredClone`），之后的执行与进度回调不会与调用方共享引用。无法结构化克隆的输入（含函数、DOM 节点、Cesium 原生对象等）会降级为保留原引用，并在结果 `warnings` 中记录一条稳定告警；此类调用方需自行保证输入在执行期间不被修改，或通过 `snapshot` 钩子提供可克隆投影。该降级会通过 `warnings` 明确暴露，调用方据此决定是否提供 `snapshot`。

Worker 队列合同：`AnalysisJobHost.run()` 在入队前对作业执行 `structuredClone`，排队与投递只使用该快照，调用方随后修改原始对象、数组或嵌套字段不会影响计算。运行时缺少 `structuredClone` 时以 `UNSUPPORTED_CAPABILITY` 明确拒绝；作业包含函数、DOM 等不可克隆内容时以 `INVALID_FORMAT` 拒绝，两种情况都不会把原引用静默放入队列。

内置分析同时提供任务化方法（`*Task`），返回统一的 `AnalysisResult`，接入 `app.analysis.tasks`：

```ts
await app.analysis.measure.distanceTask({ positions }) // measure.distance
await app.analysis.measure.areaTask({ positions, holes }) // measure.area
await app.analysis.measure.heightTask({ from, to }) // measure.height
await app.analysis.measure.headingTask({ from, to }) // measure.heading
await app.analysis.measure.spaceAngleTask({ from, via, to }) // measure.spaceAngle
await app.analysis.terrain.sampleHeightTask({ position }) // terrain.sampleHeight
await app.analysis.terrain.slopeTask({ position }) // terrain.slope
await app.analysis.terrain.profileTask({ positions }) // terrain.profile（profile 产物）
await app.analysis.visibility.lineOfSightTask({ from, to }) // visibility.lineOfSight
await app.analysis.visibility.viewshedTask({ observer, radius }) // viewshed 产物
await app.analysis.query.rectangleTask({ west, south, east, north })
await app.analysis.query.polygonTask({ positions })
await app.analysis.query.distanceTask({ position, meters })
await app.analysis.volume.cutFillTask({ positions }) // volume 产物
```

非任务方法返回原始结果，`*Task` 变体在 `app.analysis.tasks` 中登记任务并补齐任务 ID、状态、计时、单位、空间参考与产物。两类方法共享同一底层实现。

`distance` 为 ECEF 三维直线距离。`horizontalDistance` 为椭球面测地线距离。`height` / `verticalDistance` 为两点椭球高差。`heading` 为正北起算、顺时针方位角（0–360°）。`area` 默认球面多边形面积，可选 `mode: "planar"` 局部东-北投影；`holes` 从外环面积中扣除。

## 地形

```ts
await app.analysis.terrain.sampleHeight({ position })
await app.analysis.terrain.slope({ position, sampleMeters: 20 })
await app.analysis.terrain.profile({ positions, samples: 32 })
app.analysis.terrain.setExaggeration(2)
```

`sampleHeight` 优先 `scene.sampleHeightMostDetailed`，回退 `globe.getHeight`。`slope` 用东/北偏移点有限差分，返回坡度（度）与坡向（正北起算、顺时针）。
`setExaggeration` 写入 `scene.verticalExaggeration`。

采样结果带 `source` 与 `status`：`sampleHeight` 为真实采样，`globe` 为 Globe 高程，`ellipsoid` 为无地形时的椭球高 0。`status` 为 `sampled` / `fallback` / `unavailable` / `cancelled`。真实零高程来自 `globe` 或 `sampleHeight`，状态为 `sampled`；`unavailable` 表示没有拿到任何高程，可能是地形缺失或超出数据覆盖范围，Cesium 当前接口不返回具体原因，因此调用方必须把 `unavailable` 视为无数据，不能当作真实 0 米。`profile` 返回的每个剖面点同样携带 `source` / `status`。分析任务支持 `signal` 取消、`onProgress` 进度、`maxSamples` 上限；地形采样依赖 Cesium scene，在主线程分块让出，不使用 Worker。

## 通视

```ts
await app.analysis.visibility.lineOfSight({ from, to, samples: 32 })
await app.analysis.visibility.viewshed({
  observer,
  radius,
  rays: 36,
  observerHeight: 2,
})
```

`lineOfSight` 沿视线插值，比较线高与地形高。`viewshed` 径向通视采样，返回每条射线 `rangeMeters`。`draw: true` 用贴地扇区 Primitive 画出可见包络。

视线按 ECEF 弦插值，包含地球曲率。`viewshed` 观察点高程为地形高加 `observerHeight`（默认 2 米），射线间隔为 `360 / rays` 度，远端点取观察点处地形高。

## 体积

```ts
await app.analysis.volume.cutFill({ positions, samples: 16, designHeight })
await app.analysis.volume.excavate({ positions, depth: 20 })
app.analysis.volume.clear()
```

`cutFill` 在多边形内网格采样，相对设计高程累计挖方 / 填方（立方米）。`excavate` 用 Globe 多边形剖切加底部水平面表示开挖。

`cutFill` 使用局部东-北投影网格，边界单元按覆盖率加权，并返回 `resolutionMeters` 与 `estimatedErrorCubicMeters`。`cutFill` 结果带 `status`：`computed` 为正常结果，`invalid-polygon` 为顶点少于 3，`empty-grid` 为网格为空；非 `computed` 时各体积字段为 0，调用者可据此区分「体积确实为 0」与「输入非法」。`terrain` 统计采样来源：`sampled` 为真实地形，`fallback` 为回退高程，`unavailable` 为无地形并按椭球高 0 计算；`terrain.quality` 进一步给出 `complete`（全部真实）、`partial`（部分回退）与 `degraded`（存在无数据点）三档。`cutFillTask` 会把 `partial` / `degraded` 转成 `warnings`，调用方无需自行比较计数。`excavate` 在 `depth > 0` 时启用多边形剖切加 ENU 底面，形成有深度的 Globe 开挖体；`depth = 0` 仅为表面多边形裁切，`volumetric` 为 false。

## 计算模型与适用边界

数值分析结果通过只读字段 `model`（`ComputationModel`）显式标注其计算模型，用于区分精确量与近似量，避免把仅在小范围有效的算法当作无条件通用。

| `model`           | 含义                                      | 适用边界与误差                                                                      |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `ecef-chord`      | 地心直角坐标三维弦长                      | 两点直线距离，含地球曲率效应，非地表最短路径                                        |
| `spherical`       | 半径取 WGS84 长半轴的球面近似             | 相对 WGS84 椭球量存在随纬度增大的误差（通常在小数百分点量级），且不含大地线方向修正 |
| `local-planar`    | 以原点固定 `cos(lat)` 的局部东-北平面近似 | 仅在原点附近、非极区的小范围内有效；高纬、大范围经向失真，近极点经度退化            |
| `ellipsoid-delta` | 椭球高差                                  | 垂直方向，与高程基准一致                                                            |

映射：`distance` 为 `ecef-chord`；`horizontalDistance` / `projectedDistance` / `surfaceDistance` 与 `mode: "geodesic"` 的面积（`area` 默认、`triangleArea`）为 `spherical`；`area` 的 `mode: "planar"` 为 `local-planar`；`height` / `verticalDistance` 为 `ellipsoid-delta`。`mode` 仍表示调用者选择的算法模式，`model` 表示实际数值模型，两者互补。

缓冲（`buffer.point` / `polyline` / `polygon`）与土方网格 `buildCutFillGrid` 均基于 `local-planar`，以首个顶点/圆心为原点固定经度缩放，仅在目标附近、非极区的小范围内可靠。

高程基准目前仅椭球高（`heightDatum: "ellipsoid"`），缺失高度按 `MISSING_HEIGHT = 0` 处理；地形采样与剖面点以 `source` / `status` 标识真实高程、回退值与不可用，不以 0 米混淆语义。

`estimatedErrorCubicMeters` 为边界单元被部分覆盖时按 `0.5 × 单元面积 × |高差|` 累计的经验量级指标，用于提示误差来源与相对大小，**不是**数学误差上界。

误差来源分三类：数值误差（球面/局部平面近似、边界覆盖率与网格分辨率）、数据覆盖误差（`terrain.quality` 的 `partial` / `degraded`）与地形源误差（`globe` 回退或真实地形本身的精度）。采样密度越高，边界覆盖率误差越小，但耗时与内存随网格单元数按平方增长；`resolutionMeters` 是判断采样密度的直接指标。known-answer 测试使用轴对齐矩形的解析面积与常量高差棱柱，验证网格面积随采样数收敛，并记录 5% 的相对误差容限；该容限用于捕获数量级错误，不构成工程精度承诺。

### 适用边界与调用方责任

- **数值输入校验**：位置坐标、矩形边界、查询距离阈值、坡度采样间距、可视域半径与观察高度、采样数量在进入数值计算前校验；非有限值、越界经纬度、倒置纬度、非正半径/间距或超过 `1e9` 米的绝对高度以 `INVALID_ARGUMENT` 拒绝，不会静默降级为 0、空结果、`Infinity` 或 `NaN`。几何入口同样校验坐标范围与高度量级，避免地心坐标计算溢出。
- **坐标参考**：输入统一为 WGS84 经纬度与椭球高。投影坐标反算、地方坐标系转换、正高/大地水准面转换由调用方在进入分析 API 前完成；`createCoordinateTransform` 仅在参考完全等价时返回恒等转换，其余情况抛 `UNSUPPORTED_CAPABILITY`。
- **多边形拓扑**：环按简单多边形处理，不做自相交检测、拓扑修复或环方向归一化；孔洞面积始终从外环扣除。带自相交、重叠环或复杂洞的输入需要调用方预先清理。
- **跨日界线**：面积计算使用 `unwrapRing` 连续化经度，矩形查询使用 `splitRectAtAntimeridian` 拆分。跨线处理集中在这些路径；其他输入若在 180° 两侧跳变，调用方应先规范化经度或分段，避免把跨线几何解释为长路径。
- **高纬与极点**：`local-planar` 模型在近极点处经度缩放趋近于 0，缓冲、平面面积与土方网格不适合极区或大范围输入；`spherical` 模型仍为球面近似，高纬精度低于椭球精确解。
- **地形 no-data**：地形采样以 `source` / `status` 标识真实值、回退值与不可用值，真实零高程为 `sampled`，无数据为 `unavailable`。`cutFill` 的 `terrain.quality` 为 `complete` / `partial` / `degraded`，`unavailable` 的网格点按椭球高 0 参与体积计算，结果只能作为降级参考；`cutFillTask` 同时返回对应 `warnings`。Cesium 当前不暴露 no-data 的具体原因（地形缺失或超出覆盖范围），两者统一以 `unavailable` 表达；当前不提供逐点 no-data 掩膜。
- **精度承诺**：结果用于可视化量测与工程估算的辅助判断；测绘级成果、法定面积与土方结算需使用专业测绘软件与经过验证的坐标/高程基准流程。

## 空间查询

```ts
await app.analysis.query.rectangle({ west, south, east, north, relation })
await app.analysis.query.polygon({ positions, relation })
await app.analysis.query.distance({ position, meters })
```

查询 Graphic 几何关系，默认 `relation: "intersect"`。矩形/多边形支持点在范围内、线段相交、面相交；`within` 要求全部顶点落在查询几何内。`west > east` 的矩形按跨日界线拆分。距离查询使用点到顶点、线段或面（含内部）的椭球面最短距离。返回 `{ id, type }[]`。

## 剖切

```ts
app.analysis.clip.setPlane({ origin, heading })
app.analysis.clip.setBox({ west, south, east, north })
app.analysis.clip.setPolygon({ positions })
app.analysis.clip.list()
app.analysis.clip.clear()
```

Plane / Box 使用 Globe `ClippingPlaneCollection`。Polygon 使用 `ClippingPolygonCollection`。`app.destroy()` 回收剖切。

### 所有权与状态一致性

首次写入 Globe 裁剪槽位前，`ClipAnalysis` 记录 `globe.clippingPlanes` / `globe.clippingPolygons` 作为基线，之后只释放自身创建的集合（平面集合经 `destroy()` 释放 GPU 资源，多边形集合自 Cesium 1.145 起仅解除引用），`clear()` / `destroy()` 时把槽位恢复到基线。从未写入时 `clear()` / `destroy()` 不触碰 Globe，因此不会清理调用者或其它子系统设置的裁剪。

`setPolygon` / `setExcavation` 在顶点少于三个时，于任何场景变更之前抛 `Arc3DError("INVALID_ARGUMENT")`，旧裁剪与 `list()` 保持有效；成功路径下 `list()` 始终与实际挂载的裁剪一致。

## 分块让出、采样预算与作业 Worker

长耗时分析在块间通过 `yieldToEventLoop()` 让出控制权，默认采用真实宏任务让出：优先 `MessageChannel`，不可用时回退 `setTimeout(0)`，使渲染帧、输入与超时回调得以执行；可通过分析选项 `yieldStrategy: "microtask"` 切回微任务让出。`mapInChunks()` 与地形/通视/可视域/规模采样共享该让出路径。

采样规模按「任务级累计」计量：`AnalysisSampleBudget(maxSamples)` 以 `reserve(count)` 累加消耗，累计超过上限时抛 `Arc3DError("INVALID_ARGUMENT")` 且不改变已消耗量。`maxSamples` 与 `count` 的单位均为采样点数量，必须是非负安全整数；显式传入 `NaN`、`Infinity`、负数或小数会被拒绝，不会被替换成默认值，只有参数省略时才使用 `DEFAULT_MAX_SAMPLES`。零预算与 `reserve(0)` 合法，任何正数预留都会因额度不足失败。`viewshed` 会创建单一预算实例并由观察点与全部射线共享，`maxSamples` 因此是整次可视域的累计上限；未显式传入共享预算的单次调用保持既有的单次截断行为。

纯数值作业（矩形/多边形/距离查询、面积、测量、土方网格，见 `executeAnalysisJob`）由 `AnalysisJobHost` 投递到独立 Web Worker 执行：

```ts
const host = new AnalysisJobHost()
const result = await host.run({ type: "area", positions }, { signal })
host.destroy()
```

`AnalysisManager` 持有一个由 `app.destroy()` 终止的共享宿主。所有可结构化克隆且不依赖 Cesium 场景的高层方法都经该宿主路由：`measure.*`（距离、面积、高差、方位角、空间角、坡度、投影/表面距离、三角形面积）、`query.rectangle` / `polygon` / `distance`，以及 `volume.cutFill` 的网格构建步骤。空间查询在投递前把图形注册表投影为仅含 `id` / `type` / 顶点副本的快照，因此作业输入可跨线程传递。

场景依赖操作保持主线程执行：`terrain.*` 与 `visibility.*` 需要 Viewer / 地形采样，`volume.cutFill` 的地形采样与 `excavate` 依赖 Globe 状态。它们不会把 Viewer、Primitive 或地形闭包送入 Worker。`app.destroy()` 终止 Worker、拒绝所有未完成作业，并清理消息与取消监听；销毁后再发起的数值作业以 `CANCELLED` 结束。

宿主默认维护最多 4 个 Worker（`maxWorkers` 可配置），每个在途作业独占一个槽位，完成后槽位回到空闲池复用；超出容量的作业进入队列，队列默认最多 128 项（`maxQueue` 可配置），达到上限后新作业以 `Arc3DError("QUEUE_FULL")` 拒绝，避免无界累积。空闲 Worker 默认保留 30 秒（`idleTimeoutMs` 可配置，`0` 表示禁用回收），超时未被复用时自动终止并移出池，降低多实例长时间驻留的内存占用；回收定时器在 Node.js 中调用 `unref()`，不会阻止进程退出。宿主与 Worker 通过 `postMessage` 以作业标识匹配回复；作业与结果必须可结构化克隆，不可克隆的输入在投递前以 `Arc3DError("INVALID_FORMAT")` 拒绝；跨线程错误经 `serializeAnalysisError` / `restoreAnalysisError` 还原并保留错误码。取消一个作业只终止它独占的 Worker 并抛 `Arc3DError("CANCELLED")`，其他在途作业继续执行，排队作业由释放的槽位继续调度。

Worker 响应在结算前经过运行时校验：消息必须是对象，任务 `id` 必须是正整数，`result` 与 `error` 必须恰好出现一个，错误码必须属于公开的 `Arc3DErrorCode`，结果类型必须与请求作业一致且数值必须是有限数。可归属到当前槽位的畸形响应会终止该槽位并以 `Arc3DError("INVALID_FORMAT")` 结算任务；无法归属的畸形消息只累加诊断字段 `protocolErrors`，不会让任何任务永久挂起。`postMessage` 同步抛错时立即移除槽位，任务以 `ENGINE_FAILURE` 结算并释放并发额度；该路径不转入进程内重放，避免消息可能已部分投递时重复执行。`messageerror` 与 `error` 同样视为 Worker 基础设施故障：终止槽位、缓存 Worker 不可用，并把当前作业降级重放一次。

运行环境不提供 `Worker`、Worker 创建失败，或 Worker 异步加载/运行故障时，宿主自动降级为进程内执行，并把 Worker 缓存为不可用，避免后续请求重复创建失败实例。降级路径同样受 `maxWorkers` 与 `maxQueue` 约束，避免主线程被无界并发占满；可分块作业在块间协作式响应取消，无法分块的同步作业只能在开始前或完成后观察取消。目前 `cutfill-grid` 按网格行分块，其余面积、距离、矩形/多边形查询等纯数值作业在单次调用内同步完成，属于明确限定的不可中断操作。工作线程通过消息回传的业务错误原样返回，不做重试；降级执行器抛出的错误直接传播，每个任务最多结算一次。

取消语义按三个可观察状态定义：取消请求已发出（`signal.aborted === true`）、计算已停止（Worker 被 `terminate()`，或分块执行器在检查点退出）、结果不再交付（Promise 以 `CANCELLED` 拒绝，此后到达的消息被忽略）。Worker 路径在 abort 时同步终止线程，能够停止计算；进程内 `cutfill-grid` 在块间检查点停止；其余同步作业只能保证结果不再交付，CPU 计算仍会运行到结束。取消延迟取决于作业剩余计算量：可分块作业最多一个块的耗时，同步作业为剩余同步调用的全部耗时。任务被取消或宿主销毁后，排队项、取消监听与空闲回收定时器都会清理，迟到的 Worker 响应不会二次结算。

`AnalysisJobHost.getDiagnostics()` 返回 Worker 活动数（`activeWorkers` / `idleWorkers` / `runningJobs`）、池容量与回收情况（`createdWorkers` / `reclaimedWorkers` / `peakWorkers` / `idleTimeoutMs`）、队列深度（`queuedJobs`）、进程内降级状态（`inProcessJobs` / `inProcessCancellation`）、任务计数（`startedJobs` / `completedJobs` / `cancelledJobs` / `failedJobs` / `rejectedJobs` / `protocolErrors`）以及耗时统计（`timedJobs` / `totalExecutionMs` / `averageExecutionMs` / `maxExecutionMs` / `lastExecutionMs`）；`AnalysisManager.getDiagnostics()` 转发同一份快照。耗时从作业首次开始执行计到结束，包含成功、失败与已开始的取消；排队期间与从未开始的作业不产生耗时样本。
