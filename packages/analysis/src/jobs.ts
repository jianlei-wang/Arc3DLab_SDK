import { Arc3DError, parsePosition, type LngLatHeight, type PositionInput } from "@arc3dlab/core"
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

export interface QueryGraphic {
  id: string
  type: string
  positions: LngLatHeight[]
}

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

export type AnalysisJobResult =
  | { type: "query"; graphics: Array<{ id: string; type: string }> }
  | { type: "area"; squareMeters: number }
  | { type: "cutfill-grid"; grid: CutFillGrid }

export function executeAnalysisJob(job: AnalysisJob): AnalysisJobResult {
  if (job.type === "rect-query") {
    const relation = job.relation ?? "intersect"
    return {
      type: "query",
      graphics: job.graphics
        .filter((item) => geometryMatchesRect(item.type, item.positions, job.rect, relation))
        .map((item) => ({ id: item.id, type: item.type })),
    }
  }
  if (job.type === "polygon-query") {
    const relation = job.relation ?? "intersect"
    const ring = job.positions.map(toMeasurePoint)
    return {
      type: "query",
      graphics: job.graphics
        .filter((item) => geometryMatchesPolygon(item.type, item.positions, ring, relation))
        .map((item) => ({ id: item.id, type: item.type })),
    }
  }
  if (job.type === "area") {
    const outer = job.positions.map(toMeasurePoint)
    const holes = (job.holes ?? []).map((ring) => ring.map(toMeasurePoint))
    return {
      type: "area",
      squareMeters: polygonAreaSquareMeters(outer, holes, job.mode ?? "geodesic"),
    }
  }
  if (job.type === "cutfill-grid") {
    return {
      type: "cutfill-grid",
      grid: buildCutFillGrid(job.polygon.map(parsePosition), job.samples),
    }
  }
  throw new Arc3DError("INVALID_ARGUMENT", `Unknown analysis job: ${String((job as AnalysisJob).type)}`)
}
