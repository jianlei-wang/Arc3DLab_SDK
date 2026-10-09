import type { Arc3DContext, LngLatHeight, PositionInput, ResourceHandle } from "@arc3dlab/core"
import {
  anyVertexInPolygon,
  anyVertexInRect,
  anyVertexWithinMeters,
  type RectQuery,
} from "./math"

const GRAPHIC_TYPES = new Set(["point", "polyline", "polygon", "model"])

export interface QueryHit {
  id: string
  type: string
}

function toLngLat(input: PositionInput): LngLatHeight {
  if (Array.isArray(input)) {
    return { longitude: input[0], latitude: input[1], height: input[2] ?? 0 }
  }
  return {
    longitude: input.longitude,
    latitude: input.latitude,
    height: "height" in input ? input.height : 0,
  }
}

function graphicPositions(item: ResourceHandle): LngLatHeight[] {
  const positions = (item as ResourceHandle & { positions?: LngLatHeight[] }).positions
  return Array.isArray(positions) ? positions : []
}

export class SpatialQueryService {
  constructor(private readonly context: Arc3DContext) {}

  async rectangle(rect: RectQuery): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query rectangle")
    return { graphics: this.collect((positions) => anyVertexInRect(positions, rect)) }
  }

  async polygon(options: { positions: PositionInput[] }): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query polygon")
    const ring = options.positions.map(toLngLat)
    return { graphics: this.collect((positions) => anyVertexInPolygon(positions, ring)) }
  }

  async distance(options: { position: PositionInput; meters: number }): Promise<{ graphics: QueryHit[] }> {
    this.context.lifecycle.assertUsable("query distance")
    const center = toLngLat(options.position)
    return {
      graphics: this.collect((positions) => anyVertexWithinMeters(positions, center, options.meters)),
    }
  }

  private collect(match: (positions: LngLatHeight[]) => boolean): QueryHit[] {
    return this.context.registry
      .values()
      .filter((item) => GRAPHIC_TYPES.has(item.type) && match(graphicPositions(item)))
      .map((item) => ({ id: item.id, type: item.type }))
  }
}
