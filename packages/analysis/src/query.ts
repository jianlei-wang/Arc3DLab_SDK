import {
  WGS84_3D,
  type Arc3DContext,
  type LngLatHeight,
  type PositionInput,
  type ResourceHandle,
} from "@arc3dlab/core"
import {
  geometryMatchesDistance,
  geometryMatchesPolygon,
  geometryMatchesRect,
  toMeasurePoint,
  type QueryRelation,
  type RectQuery,
} from "./geometry"
import type { AnalysisResult } from "./task"
import { createTaskExecutor, type AnalysisTaskExecutor } from "./task-executor"

const GRAPHIC_TYPES = new Set(["point", "polyline", "polygon", "model"])

export interface QueryHit {
  id: string
  type: string
}

function graphicPositions(item: ResourceHandle): LngLatHeight[] {
  const positions = (item as ResourceHandle & { positions?: LngLatHeight[] })
    .positions
  return Array.isArray(positions) ? positions : []
}

export class SpatialQueryService {
  constructor(
    private readonly context: Arc3DContext,
    private readonly runTask: AnalysisTaskExecutor = createTaskExecutor(
      context,
    ),
  ) {}

  async rectangle(
    rect: RectQuery & { relation?: QueryRelation },
  ): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query rectangle")
    const relation = rect.relation ?? "intersect"
    return {
      graphics: this.collect((type, positions) =>
        geometryMatchesRect(type, positions, rect, relation),
      ),
    }
  }

  async polygon(options: {
    positions: PositionInput[]
    relation?: QueryRelation
  }): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query polygon")
    const ring = options.positions.map(toMeasurePoint)
    const relation = options.relation ?? "intersect"
    return {
      graphics: this.collect((type, positions) =>
        geometryMatchesPolygon(type, positions, ring, relation),
      ),
    }
  }

  async distance(options: {
    position: PositionInput
    meters: number
  }): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query distance")
    const center = toMeasurePoint(options.position)
    return {
      graphics: this.collect((type, positions) =>
        geometryMatchesDistance(type, positions, center, options.meters),
      ),
    }
  }

  rectangleTask(
    rect: RectQuery & { relation?: QueryRelation },
  ): Promise<AnalysisResult<{ graphics: QueryHit[] }>> {
    return this.runTask<typeof rect, { graphics: QueryHit[] }>({
      algorithm: "query.rectangle",
      input: rect,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("query rectangle")
        return { value: await this.rectangle(rect) }
      },
    })
  }

  polygonTask(options: {
    positions: PositionInput[]
    relation?: QueryRelation
  }): Promise<AnalysisResult<{ graphics: QueryHit[] }>> {
    return this.runTask<typeof options, { graphics: QueryHit[] }>({
      algorithm: "query.polygon",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("query polygon")
        return { value: await this.polygon(options) }
      },
    })
  }

  distanceTask(options: {
    position: PositionInput
    meters: number
  }): Promise<AnalysisResult<{ graphics: QueryHit[] }>> {
    return this.runTask<typeof options, { graphics: QueryHit[] }>({
      algorithm: "query.distance",
      input: options,
      spatialReference: WGS84_3D,
      execute: async (runner) => {
        runner.throwIfCancelled("query distance")
        return { value: await this.distance(options) }
      },
    })
  }

  private collect(
    match: (type: string, positions: LngLatHeight[]) => boolean,
  ): QueryHit[] {
    return this.context.registry
      .values()
      .filter(
        (item) =>
          GRAPHIC_TYPES.has(item.type) &&
          match(item.type, graphicPositions(item)),
      )
      .map((item) => ({ id: item.id, type: item.type }))
  }
}
