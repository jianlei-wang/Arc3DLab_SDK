import {
  ELLIPSOID_VERTICAL,
  WGS84_3D,
  type Arc3DContext,
  type PositionInput,
} from "@arc3dlab/core"
import { TerrainAnalysis } from "./terrain"
import { VisibilityAnalysis } from "./visibility"
import { SpatialQueryService } from "./query"
import { ClipAnalysis } from "./clip"
import { VolumeAnalysis } from "./volume"
import {
  ellipsoidHeightDelta,
  headingDegrees,
  pathLengthMeters,
  polygonAreaSquareMeters,
  spaceAngleDegrees,
  toMeasurePoint,
} from "./geometry"
import {
  ANALYSIS_UNITS,
  type AngleResult,
  type AreaMode,
  type AreaResult,
  type HeightResult,
  type LengthResult,
} from "./units"
import {
  AnalysisTaskRegistry,
  runAnalysisTask,
  type AnalysisResult,
  type RunAnalysisTaskOptions,
} from "./task"
import { createTaskExecutor, type AnalysisTaskExecutor } from "./task-executor"
import { BufferService } from "./buffer"
import { RouteOverlay } from "./path"
import { HeatmapOverlay } from "./heatmap-overlay"
import { DynamicHeatmapOverlay } from "./dynamic-heatmap"
import { FloodAnalysis } from "./flood"
import { SwipeComparison } from "./split"
import {
  projectedDistanceMeters,
  slopeAngleDegrees,
  surfaceDistanceMeters,
  triangleAreaSquareMeters,
} from "./measure-tools"

/** 测量服务，提供距离、面积、高度、方位角与空间角等测量能力。 */
export class MeasurementService {
  /**
   * 创建测量服务。
   * @param context - Arc3D 运行上下文。
   * @param runTask - 任务执行器，默认绑定当前上下文。
   */
  constructor(
    private readonly context: Arc3DContext,
    private readonly runTask: AnalysisTaskExecutor = createTaskExecutor(
      context,
    ),
  ) {}

  /**
   * 计算折线路径长度。
   * @param options - 测量选项，包含路径顶点列表。
   * @returns 长度测量结果。
   */
  async distance(options: {
    positions: PositionInput[]
  }): Promise<LengthResult> {
    this.context.lifecycle.assertUsable("measure distance")
    const points = options.positions.map(toMeasurePoint)
    return {
      meters: pathLengthMeters(points, "cartesian"),
      units: ANALYSIS_UNITS.length,
      mode: "cartesian",
      heightDatum: "ellipsoid",
    }
  }

  /**
   * 计算多边形的面积。
   * @param options - 测量选项，包含外环顶点、孔洞与面积模式。
   * @returns 面积测量结果。
   */
  async area(options: {
    positions: PositionInput[]
    holes?: PositionInput[][]
    mode?: AreaMode
  }): Promise<AreaResult> {
    this.context.lifecycle.assertUsable("measure area")
    const mode = options.mode ?? "geodesic"
    const outer = options.positions.map(toMeasurePoint)
    const holes = (options.holes ?? []).map((ring) => ring.map(toMeasurePoint))
    return {
      squareMeters: polygonAreaSquareMeters(outer, holes, mode),
      units: ANALYSIS_UNITS.area,
      mode,
    }
  }

  /**
   * 计算两点之间的椭球高差。
   * @param options - 测量选项，包含起点与终点。
   * @returns 高度测量结果。
   */
  async height(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<HeightResult> {
    this.context.lifecycle.assertUsable("measure height")
    return {
      meters: ellipsoidHeightDelta(
        toMeasurePoint(options.from),
        toMeasurePoint(options.to),
      ),
      units: ANALYSIS_UNITS.length,
      heightDatum: "ellipsoid",
    }
  }

  /**
   * 计算两点之间的垂直距离。
   * @param options - 测量选项，包含起点与终点。
   * @returns 高度测量结果。
   */
  async verticalDistance(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<HeightResult> {
    return this.height(options)
  }

  /**
   * 计算两点之间的水平距离。
   * @param options - 测量选项，包含起点与终点。
   * @returns 长度测量结果。
   */
  async horizontalDistance(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<LengthResult> {
    this.context.lifecycle.assertUsable("measure horizontal distance")
    const from = toMeasurePoint(options.from)
    const to = toMeasurePoint(options.to)
    return {
      meters: pathLengthMeters(
        [
          { ...from, height: 0 },
          { ...to, height: 0 },
        ],
        "geodesic",
      ),
      units: ANALYSIS_UNITS.length,
      mode: "geodesic",
      heightDatum: "ellipsoid",
    }
  }

  /**
   * 计算从起点指向终点的方位角。
   * @param options - 测量选项，包含起点与终点。
   * @returns 角度测量结果。
   */
  async heading(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<AngleResult> {
    this.context.lifecycle.assertUsable("measure heading")
    return {
      degrees: headingDegrees(
        toMeasurePoint(options.from),
        toMeasurePoint(options.to),
      ),
      units: ANALYSIS_UNITS.angle,
      reference: "north-clockwise",
    }
  }

  /**
   * 计算由起点、顶点、终点构成的空间角。
   * @param options - 测量选项，包含起点、顶点与终点。
   * @returns 角度测量结果。
   */
  async spaceAngle(options: {
    from: PositionInput
    via: PositionInput
    to: PositionInput
  }): Promise<AngleResult> {
    this.context.lifecycle.assertUsable("measure space angle")
    return {
      degrees: spaceAngleDegrees(
        toMeasurePoint(options.from),
        toMeasurePoint(options.via),
        toMeasurePoint(options.to),
      ),
      units: ANALYSIS_UNITS.angle,
    }
  }

  /**
   * 计算由起点指向终点的连线与水平面的夹角。
   * @param options - 测量选项，包含起点与终点。
   * @returns 角度测量结果。
   */
  async slope(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<AngleResult> {
    this.context.lifecycle.assertUsable("measure slope")
    return {
      degrees: slopeAngleDegrees(
        toMeasurePoint(options.from),
        toMeasurePoint(options.to),
      ),
      units: ANALYSIS_UNITS.angle,
    }
  }

  /**
   * 计算两点在椭球面上的投影距离，忽略高度差。
   * @param options - 测量选项，包含起点与终点。
   * @returns 长度测量结果。
   */
  async projectedDistance(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<LengthResult> {
    this.context.lifecycle.assertUsable("measure projected distance")
    return {
      meters: projectedDistanceMeters(
        toMeasurePoint(options.from),
        toMeasurePoint(options.to),
      ),
      units: ANALYSIS_UNITS.length,
      mode: "geodesic",
      heightDatum: "ellipsoid",
    }
  }

  /**
   * 计算折线沿椭球面的表面距离。
   * @param options - 测量选项，包含路径顶点列表。
   * @returns 长度测量结果。
   */
  async surfaceDistance(options: {
    positions: PositionInput[]
  }): Promise<LengthResult> {
    this.context.lifecycle.assertUsable("measure surface distance")
    return {
      meters: surfaceDistanceMeters(options.positions.map(toMeasurePoint)),
      units: ANALYSIS_UNITS.length,
      mode: "geodesic",
      heightDatum: "ellipsoid",
    }
  }

  /**
   * 计算由三个顶点构成的三角形面积。
   * @param options - 测量选项，包含三个顶点。
   * @returns 面积测量结果。
   */
  async triangleArea(options: {
    positions: [PositionInput, PositionInput, PositionInput]
  }): Promise<AreaResult> {
    this.context.lifecycle.assertUsable("measure triangle area")
    const [a, b, c] = options.positions.map(toMeasurePoint)
    return {
      squareMeters: triangleAreaSquareMeters(a, b, c),
      units: ANALYSIS_UNITS.area,
      mode: "geodesic",
    }
  }

  /**
   * 以任务形式计算折线路径长度。
   * @param options - 测量选项，包含路径顶点列表。
   * @returns 分析结果，结果值为长度测量结果。
   */
  distanceTask(options: {
    positions: PositionInput[]
  }): Promise<AnalysisResult<LengthResult>> {
    return this.runTask<typeof options, LengthResult>({
      algorithm: "measure.distance",
      input: options,
      spatialReference: WGS84_3D,
      verticalReference: ELLIPSOID_VERTICAL,
      execute: async (runner) => {
        runner.throwIfCancelled("measure distance")
        return {
          value: await this.distance(options),
          units: { length: "m" },
        }
      },
    })
  }

  /**
   * 以任务形式计算多边形面积。
   * @param options - 测量选项，包含外环顶点、孔洞与面积模式。
   * @returns 分析结果，结果值为面积测量结果。
   */
  areaTask(options: {
    positions: PositionInput[]
    holes?: PositionInput[][]
    mode?: AreaMode
  }): Promise<AnalysisResult<AreaResult>> {
    return this.runTask<typeof options, AreaResult>({
      algorithm: "measure.area",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("measure area")
        return { value: await this.area(options), units: { area: "m2" } }
      },
    })
  }

  /**
   * 以任务形式计算两点之间的椭球高差。
   * @param options - 测量选项，包含起点与终点。
   * @returns 分析结果，结果值为高度测量结果。
   */
  heightTask(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<AnalysisResult<HeightResult>> {
    return this.runTask<typeof options, HeightResult>({
      algorithm: "measure.height",
      input: options,
      spatialReference: WGS84_3D,
      verticalReference: ELLIPSOID_VERTICAL,
      execute: async (runner) => {
        runner.throwIfCancelled("measure height")
        return {
          value: await this.height(options),
          units: { length: "m" },
        }
      },
    })
  }

  /**
   * 以任务形式计算方位角。
   * @param options - 测量选项，包含起点与终点。
   * @returns 分析结果，结果值为角度测量结果。
   */
  headingTask(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<AnalysisResult<AngleResult>> {
    return this.runTask<typeof options, AngleResult>({
      algorithm: "measure.heading",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("measure heading")
        return {
          value: await this.heading(options),
          units: { angle: "deg" },
        }
      },
    })
  }

  /**
   * 以任务形式计算空间角。
   * @param options - 测量选项，包含起点、顶点与终点。
   * @returns 分析结果，结果值为角度测量结果。
   */
  spaceAngleTask(options: {
    from: PositionInput
    via: PositionInput
    to: PositionInput
  }): Promise<AnalysisResult<AngleResult>> {
    return this.runTask<typeof options, AngleResult>({
      algorithm: "measure.spaceAngle",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("measure space angle")
        return {
          value: await this.spaceAngle(options),
          units: { angle: "deg" },
        }
      },
    })
  }

  /**
   * 以任务形式计算坡角。
   * @param options - 测量选项，包含起点与终点。
   * @returns 分析结果，结果值为角度测量结果。
   */
  slopeTask(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<AnalysisResult<AngleResult>> {
    return this.runTask<typeof options, AngleResult>({
      algorithm: "measure.slope",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("measure slope")
        return { value: await this.slope(options), units: { angle: "deg" } }
      },
    })
  }

  /**
   * 以任务形式计算投影距离。
   * @param options - 测量选项，包含起点与终点。
   * @returns 分析结果，结果值为长度测量结果。
   */
  projectedDistanceTask(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<AnalysisResult<LengthResult>> {
    return this.runTask<typeof options, LengthResult>({
      algorithm: "measure.projectedDistance",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("measure projected distance")
        return {
          value: await this.projectedDistance(options),
          units: { length: "m" },
        }
      },
    })
  }

  /**
   * 以任务形式计算表面距离。
   * @param options - 测量选项，包含路径顶点列表。
   * @returns 分析结果，结果值为长度测量结果。
   */
  surfaceDistanceTask(options: {
    positions: PositionInput[]
  }): Promise<AnalysisResult<LengthResult>> {
    return this.runTask<typeof options, LengthResult>({
      algorithm: "measure.surfaceDistance",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("measure surface distance")
        return {
          value: await this.surfaceDistance(options),
          units: { length: "m" },
        }
      },
    })
  }

  /**
   * 以任务形式计算三角形面积。
   * @param options - 测量选项，包含三个顶点。
   * @returns 分析结果，结果值为面积测量结果。
   */
  triangleAreaTask(options: {
    positions: [PositionInput, PositionInput, PositionInput]
  }): Promise<AnalysisResult<AreaResult>> {
    return this.runTask<typeof options, AreaResult>({
      algorithm: "measure.triangleArea",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("measure triangle area")
        return {
          value: await this.triangleArea(options),
          units: { area: "m2" },
        }
      },
    })
  }
}

/** 分析管理器，统一聚合测量、地形、可见性、查询、裁剪与体积等分析服务。 */
export class AnalysisManager {
  /** 测量服务。 */
  readonly measure: MeasurementService
  /** 地形分析服务。 */
  readonly terrain: TerrainAnalysis
  /** 可见性分析服务。 */
  readonly visibility: VisibilityAnalysis
  /** 空间查询服务。 */
  readonly query: SpatialQueryService
  /** 裁剪分析服务。 */
  readonly clip: ClipAnalysis
  /** 体积分析服务。 */
  readonly volume: VolumeAnalysis
  /** 缓冲区分析服务。 */
  readonly buffer: BufferService
  /** 路径渲染服务。 */
  readonly path: RouteOverlay
  /** 热力图可视化服务。 */
  readonly heatmap: HeatmapOverlay
  /** 动态热力图可视化服务。 */
  readonly dynamicHeatmap: DynamicHeatmapOverlay
  /** 洪水淹没分析服务。 */
  readonly flood: FloodAnalysis
  /** 卷帘对比服务。 */
  readonly swipe: SwipeComparison
  /** 分析任务注册表。 */
  readonly tasks: AnalysisTaskRegistry

  /**
   * 创建分析管理器并初始化各分析服务。
   * @param context - Arc3D 运行上下文。
   */
  constructor(private readonly context: Arc3DContext) {
    this.tasks = new AnalysisTaskRegistry()
    const runTask: AnalysisTaskExecutor = (options) =>
      runAnalysisTask({ ...options, context, registry: this.tasks })
    this.clip = new ClipAnalysis(context)
    this.measure = new MeasurementService(context, runTask)
    this.terrain = new TerrainAnalysis(context, runTask)
    this.visibility = new VisibilityAnalysis(context, runTask)
    this.query = new SpatialQueryService(context, runTask)
    this.volume = new VolumeAnalysis(context, this.clip, runTask)
    this.buffer = new BufferService(context)
    this.path = new RouteOverlay(context)
    this.heatmap = new HeatmapOverlay(context)
    this.dynamicHeatmap = new DynamicHeatmapOverlay(context)
    this.flood = new FloodAnalysis(context)
    this.swipe = new SwipeComparison(context)
  }

  /**
   * 以统一契约运行一次自定义分析任务。
   * @param options - 运行选项，不含上下文与注册表（由管理器提供）。
   * @returns 分析结果。
   */
  run<TInput, TResult>(
    options: Omit<
      RunAnalysisTaskOptions<TInput, TResult>,
      "context" | "registry"
    >,
  ): Promise<AnalysisResult<TResult>> {
    return runAnalysisTask({
      ...options,
      context: this.context,
      registry: this.tasks,
    })
  }

  /** 销毁管理器并释放各分析服务占用的资源。 */
  destroy(): void {
    this.visibility.destroy()
    this.volume.destroy()
    this.path.destroy()
    this.heatmap.destroy()
    this.dynamicHeatmap.destroy()
    this.flood.destroy()
    this.swipe.destroy()
    this.clip.destroy()
    this.tasks.clear()
  }
}

export { TerrainAnalysis } from "./terrain"
export { VisibilityAnalysis } from "./visibility"
export { SpatialQueryService } from "./query"
export { ClipAnalysis, type ExcavationResult } from "./clip"
export { VolumeAnalysis, type CutFillResult } from "./volume"
export {
  slopeFromHeights,
  lineOfSightFromSamples,
  destinationLngLat,
  pointInRect,
  pointInPolygon,
  haversineMeters,
  rayRangeMeters,
  accumulateCutFill,
  viewshedEnvelope,
} from "./math"
export {
  ANALYSIS_UNITS,
  MISSING_HEIGHT,
  type LengthResult,
  type AreaResult,
  type AngleResult,
  type HeightResult,
  type DistanceMode,
  type AreaMode,
  type HeightDatum,
} from "./units"
export {
  cartesianDistanceMeters,
  geodesicDistanceMeters,
  headingDegrees,
  polygonAreaSquareMeters,
  splitRectAtAntimeridian,
  unwrapRing,
  geometryMatchesRect,
  geometryMatchesPolygon,
  geometryMatchesDistance,
  type QueryRelation,
  type RectQuery,
  type LngLatLike,
} from "./geometry"
export {
  resolveTerrainSample,
  type SampledHeight,
  type TerrainHeightSource,
  type TerrainSampleStatus,
} from "./sampler"
export {
  DEFAULT_MAX_SAMPLES,
  clampSampleCount,
  type AnalysisTaskOptions,
  type AnalysisProgress,
} from "./scheduler"
export { buildCutFillGrid, accumulateCutFillWeighted } from "./cutfill"
export {
  executeAnalysisJob,
  type AnalysisJob,
  type AnalysisJobResult,
} from "./jobs"
export {
  AnalysisJobHost,
  AnalysisJobHost as AnalysisWorkerHost,
  serializeAnalysisError,
  restoreAnalysisError,
} from "./worker-host"
export {
  AnalysisTaskRegistry,
  runAnalysisTask,
  type AnalysisTask,
  type AnalysisTaskStatus,
  type AnalysisResult,
  type AnalysisExecution,
  type AnalysisTaskRunner,
  type AnalysisUnits,
  type ResultArtifact,
  type ArtifactKind,
  type RunAnalysisTaskOptions,
} from "./task"
export { createTaskExecutor, type AnalysisTaskExecutor } from "./task-executor"
export {
  BufferService,
  bufferPoint,
  bufferPolyline,
  bufferPolygon,
  type BufferOptions,
} from "./buffer"
export {
  projectedDistanceMeters,
  projectToEllipsoid,
  slopeAngleDegrees,
  surfaceDistanceMeters,
  triangleAreaSquareMeters,
  type LngLatHeightLike,
} from "./measure-tools"
export {
  RouteOverlay,
  routeStatusColor,
  formatDistance,
  formatDuration,
  formatRouteSummary,
  DEFAULT_ROUTE_COLORS,
  type RouteResult,
  type RouteSegment,
  type RouteStatus,
  type RouteStyle,
} from "./path"
export {
  computeHeatmapGrid,
  gridToRgba,
  sampleGradient,
  DEFAULT_HEATMAP_GRADIENT,
  type GradientStop,
  type HeatmapGrid,
  type HeatmapGridOptions,
  type HeatmapPoint,
} from "./heatmap"
export {
  HeatmapOverlay,
  type HeatmapMode,
  type HeatmapRenderOptions,
} from "./heatmap-overlay"
export {
  DynamicHeatmapOverlay,
  interpolateHeatmapGrid,
  type DynamicHeatmapFrame,
} from "./dynamic-heatmap"
export {
  FloodAnalysis,
  computeFloodGrid,
  FLOOD_WATER_DEFAULTS,
  FLOOD_WATER_MATERIAL,
  type FloodGridOptions,
  type FloodGridResult,
  type FloodWaterOptions,
} from "./flood"
export { SwipeComparison, type SwipeOrientation, type SwipeSide } from "./split"
