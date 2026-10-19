import {
  Arc3DError,
  parsePosition,
  type LngLatHeight,
  type PositionInput,
} from "@arc3dlab/core"
import {
  ellipsoidHeightDelta,
  geometryMatchesDistance,
  geometryMatchesPolygon,
  geometryMatchesRect,
  headingDegrees,
  pathLengthMeters,
  polygonAreaSquareMeters,
  spaceAngleDegrees,
  toMeasurePoint,
  type QueryRelation,
  type RectQuery,
} from "./geometry"
import {
  buildCutFillGrid,
  buildCutFillGridAsync,
  type CutFillGrid,
} from "./cutfill"
import {
  projectedDistanceMeters,
  slopeAngleDegrees,
  surfaceDistanceMeters,
  triangleAreaSquareMeters,
} from "./measure-tools"
import type { AreaMode } from "./units"
import { assertDistanceThreshold, assertRectQuery } from "./validation"

/** 参与空间查询的图形，包含标识、类型与顶点。 */
export interface QueryGraphic {
  /** 图形标识。 */
  id: string
  /** 图形类型。 */
  type: string
  /** 图形顶点列表。 */
  positions: LngLatHeight[]
}

/** 空间查询命中的图形信息。 */
export interface JobQueryHit {
  /** 图形标识。 */
  id: string
  /** 图形类型。 */
  type: string
}

/** 可在工作线程中执行的分析作业，按类型区分查询、测量、面积与土方网格。 */
export type AnalysisJob =
  | {
      type: "rect-query"
      graphics: QueryGraphic[]
      rect: RectQuery
      relation?: QueryRelation
    }
  | {
      type: "polygon-query"
      graphics: QueryGraphic[]
      positions: PositionInput[]
      relation?: QueryRelation
    }
  | {
      type: "distance-query"
      graphics: QueryGraphic[]
      position: PositionInput
      meters: number
    }
  | {
      type: "area"
      positions: PositionInput[]
      holes?: PositionInput[][]
      mode?: AreaMode
    }
  | {
      type: "distance"
      positions: PositionInput[]
    }
  | {
      type: "height"
      from: PositionInput
      to: PositionInput
    }
  | {
      type: "heading"
      from: PositionInput
      to: PositionInput
    }
  | {
      type: "space-angle"
      from: PositionInput
      via: PositionInput
      to: PositionInput
    }
  | {
      type: "slope"
      from: PositionInput
      to: PositionInput
    }
  | {
      type: "projected-distance"
      from: PositionInput
      to: PositionInput
    }
  | {
      type: "surface-distance"
      positions: PositionInput[]
    }
  | {
      type: "triangle-area"
      positions: [PositionInput, PositionInput, PositionInput]
    }
  | {
      type: "cutfill-grid"
      polygon: PositionInput[]
      samples: number
    }

/** 分析作业的执行结果，按作业类型返回查询命中、数值或土方网格。 */
export type AnalysisJobResult =
  | { type: "query"; graphics: JobQueryHit[] }
  | { type: "area"; squareMeters: number }
  | { type: "distance"; meters: number }
  | { type: "height"; meters: number }
  | { type: "heading"; degrees: number }
  | { type: "space-angle"; degrees: number }
  | { type: "slope"; degrees: number }
  | { type: "projected-distance"; meters: number }
  | { type: "surface-distance"; meters: number }
  | { type: "triangle-area"; squareMeters: number }
  | { type: "cutfill-grid"; grid: CutFillGrid }

/**
 * 在进程内同步执行一个分析作业。
 *
 * 该函数只依赖纯数值几何算法，不读取 Cesium Viewer、Primitive 或地形状态，
 * 因此同一份作业既可在主线程降级执行，也可投递到工作线程。
 *
 * @param job - 待执行的分析作业。
 * @returns 作业执行结果。
 * @throws {Arc3DError} 作业类型未知时抛出。
 */
export function executeAnalysisJob(job: AnalysisJob): AnalysisJobResult {
  if (job.type === "rect-query") {
    assertRectQuery(job.rect)
    const relation = job.relation ?? "intersect"
    return {
      type: "query",
      graphics: job.graphics
        .filter((item) =>
          geometryMatchesRect(item.type, item.positions, job.rect, relation),
        )
        .map((item) => ({ id: item.id, type: item.type })),
    }
  }
  if (job.type === "polygon-query") {
    const relation = job.relation ?? "intersect"
    const ring = job.positions.map(toMeasurePoint)
    return {
      type: "query",
      graphics: job.graphics
        .filter((item) =>
          geometryMatchesPolygon(item.type, item.positions, ring, relation),
        )
        .map((item) => ({ id: item.id, type: item.type })),
    }
  }
  if (job.type === "distance-query") {
    assertDistanceThreshold(job.meters)
    const center = toMeasurePoint(job.position)
    return {
      type: "query",
      graphics: job.graphics
        .filter((item) =>
          geometryMatchesDistance(
            item.type,
            item.positions,
            center,
            job.meters,
          ),
        )
        .map((item) => ({ id: item.id, type: item.type })),
    }
  }
  if (job.type === "area") {
    const outer = job.positions.map(toMeasurePoint)
    const holes = (job.holes ?? []).map((ring) => ring.map(toMeasurePoint))
    return {
      type: "area",
      squareMeters: polygonAreaSquareMeters(
        outer,
        holes,
        job.mode ?? "geodesic",
      ),
    }
  }
  if (job.type === "distance") {
    return {
      type: "distance",
      meters: pathLengthMeters(job.positions.map(toMeasurePoint), "cartesian"),
    }
  }
  if (job.type === "height") {
    return {
      type: "height",
      meters: ellipsoidHeightDelta(
        toMeasurePoint(job.from),
        toMeasurePoint(job.to),
      ),
    }
  }
  if (job.type === "heading") {
    return {
      type: "heading",
      degrees: headingDegrees(toMeasurePoint(job.from), toMeasurePoint(job.to)),
    }
  }
  if (job.type === "space-angle") {
    return {
      type: "space-angle",
      degrees: spaceAngleDegrees(
        toMeasurePoint(job.from),
        toMeasurePoint(job.via),
        toMeasurePoint(job.to),
      ),
    }
  }
  if (job.type === "slope") {
    return {
      type: "slope",
      degrees: slopeAngleDegrees(
        toMeasurePoint(job.from),
        toMeasurePoint(job.to),
      ),
    }
  }
  if (job.type === "projected-distance") {
    return {
      type: "projected-distance",
      meters: projectedDistanceMeters(
        toMeasurePoint(job.from),
        toMeasurePoint(job.to),
      ),
    }
  }
  if (job.type === "surface-distance") {
    return {
      type: "surface-distance",
      meters: surfaceDistanceMeters(job.positions.map(toMeasurePoint)),
    }
  }
  if (job.type === "triangle-area") {
    const [a, b, c] = job.positions.map(toMeasurePoint)
    return {
      type: "triangle-area",
      squareMeters: triangleAreaSquareMeters(a, b, c),
    }
  }
  if (job.type === "cutfill-grid") {
    return {
      type: "cutfill-grid",
      grid: buildCutFillGrid(job.polygon.map(parsePosition), job.samples),
    }
  }
  throw new Arc3DError(
    "INVALID_ARGUMENT",
    `Unknown analysis job: ${String((job as AnalysisJob).type)}`,
  )
}

/** 进程内协作式执行作业的选项。 */
export interface CooperativeAnalysisJobOptions {
  /** 取消信号，在分块边界与执行前后检查。 */
  signal?: AbortSignal
  /** 分块之间的让出回调。 */
  yieldToEventLoop?: () => Promise<void>
}

/**
 * 在主线程以协作方式执行分析作业。
 *
 * 可分块的 `cutfill-grid` 按行分块构建，并在块间检查取消、让出事件循环；
 * 其余作业同步执行，只能在开始前与完成后观察取消，无法在执行中途被强制
 * 中断。Worker 路径通过终止线程实现强制取消，两者语义不同。
 *
 * @param job - 待执行的分析作业。
 * @param options - 取消信号与让出回调。
 * @returns 作业执行结果。
 * @throws {Arc3DError} 任务被取消时抛出。
 */
export async function executeAnalysisJobCooperatively(
  job: AnalysisJob,
  options: CooperativeAnalysisJobOptions = {},
): Promise<AnalysisJobResult> {
  if (options.signal?.aborted) {
    throw new Arc3DError("CANCELLED", "Cancelled analysis job")
  }
  if (job.type === "cutfill-grid") {
    return {
      type: "cutfill-grid",
      grid: await buildCutFillGridAsync(
        job.polygon.map(parsePosition),
        job.samples,
        options,
      ),
    }
  }
  const result = executeAnalysisJob(job)
  if (options.signal?.aborted) {
    throw new Arc3DError("CANCELLED", "Cancelled analysis job")
  }
  return result
}
