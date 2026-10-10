import {
  Arc3DError,
  parsePosition,
  type LngLatHeight,
  type PositionInput,
} from "@arc3dlab/core"
import {
  geometryMatchesPolygon,
  geometryMatchesRect,
  polygonAreaSquareMeters,
  toMeasurePoint,
  type QueryRelation,
  type RectQuery,
} from "./geometry"
import { buildCutFillGrid, type CutFillGrid } from "./cutfill"
import type { AreaMode } from "./units"

/** 参与空间查询的图形，包含标识、类型与顶点。 */
export interface QueryGraphic {
  /** 图形标识。 */
  id: string
  /** 图形类型。 */
  type: string
  /** 图形顶点列表。 */
  positions: LngLatHeight[]
}

/** 可在工作线程中执行的分析作业，按类型区分矩形查询、多边形查询、面积与土方网格。 */
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
      type: "area"
      positions: PositionInput[]
      holes?: PositionInput[][]
      mode?: AreaMode
    }
  | {
      type: "cutfill-grid"
      polygon: PositionInput[]
      samples: number
    }

/** 分析作业的执行结果，按作业类型返回查询命中、面积或土方网格。 */
export type AnalysisJobResult =
  | { type: "query"; graphics: Array<{ id: string; type: string }> }
  | { type: "area"; squareMeters: number }
  | { type: "cutfill-grid"; grid: CutFillGrid }

/**
 * 在进程内同步执行一个分析作业。
 * @param job - 待执行的分析作业。
 * @returns 作业执行结果。
 * @throws {Arc3DError} 作业类型未知时抛出。
 */
export function executeAnalysisJob(job: AnalysisJob): AnalysisJobResult {
  if (job.type === "rect-query") {
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
