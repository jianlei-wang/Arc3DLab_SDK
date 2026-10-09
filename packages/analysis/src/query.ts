import type { Arc3DContext, LngLatHeight, PositionInput, ResourceHandle } from "@arc3dlab/core"
import {
  geometryMatchesDistance,
  geometryMatchesPolygon,
  geometryMatchesRect,
  toMeasurePoint,
  type QueryRelation,
  type RectQuery,
} from "./geometry"

const GRAPHIC_TYPES = new Set(["point", "polyline", "polygon", "model"])

export interface QueryHit {
  id: string
  type: string
}

function graphicPositions(item: ResourceHandle): LngLatHeight[] {
  const positions = (item as ResourceHandle & { positions?: LngLatHeight[] }).positions
  return Array.isArray(positions) ? positions : []
}

export class SpatialQueryService {
  constructor(private readonly context: Arc3DContext) {}

  async rectangle(rect: RectQuery & { relation?: QueryRelation }): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query rectangle")
    const relation = rect.relation ?? "intersect"
    return {
      graphics: this.collect((type, positions) => geometryMatchesRect(type, positions, rect, relation)),
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
      graphics: this.collect((type, positions) => geometryMatchesPolygon(type, positions, ring, relation)),
    }
  }

  async distance(options: { position: PositionInput; meters: number }): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query distance")
    const center = toMeasurePoint(options.position)
    return {
      graphics: this.collect((type, positions) =>
        geometryMatchesDistance(type, positions, center, options.meters)
      ),
    }
  }

  private collect(match: (type: string, positions: LngLatHeight[]) => boolean): QueryHit[] {
    return this.context.registry
      .values()
      .filter((item) => GRAPHIC_TYPES.has(item.type) && match(item.type, graphicPositions(item)))
      .map((item) => ({ id: item.id, type: item.type }))
  }
}
