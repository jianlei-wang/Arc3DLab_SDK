import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import { toCartesian3, toCartesian3Array } from "@arc3dlab/engine-cesium"
import { Cartesian3, Cartographic, EllipsoidGeodesic, Math as CesiumMath } from "cesium"
import { TerrainAnalysis } from "./terrain"
import { VisibilityAnalysis } from "./visibility"
import { SpatialQueryService } from "./query"
import { ClipAnalysis } from "./clip"
import { VolumeAnalysis } from "./volume"

export class MeasurementService {
  constructor(private readonly context: Arc3DContext) {}

  async distance(options: { positions: PositionInput[] }): Promise<{ meters: number }> {
    this.context.lifecycle.assertUsable("measure distance")
    const points = toCartesian3Array(options.positions)
    let meters = 0
    for (let i = 1; i < points.length; i += 1) {
      meters += Cartesian3.distance(points[i - 1], points[i])
    }
    return { meters }
  }

  async area(options: { positions: PositionInput[] }): Promise<{ squareMeters: number }> {
    this.context.lifecycle.assertUsable("measure area")
    const points = toCartesian3Array(options.positions)
    if (points.length < 3) return { squareMeters: 0 }
    const origin = points[0]
    let area = 0
    for (let i = 1; i < points.length - 1; i += 1) {
      const v1 = Cartesian3.subtract(points[i], origin, new Cartesian3())
      const v2 = Cartesian3.subtract(points[i + 1], origin, new Cartesian3())
      const cross = Cartesian3.cross(v1, v2, new Cartesian3())
      area += Cartesian3.magnitude(cross) / 2
    }
    return { squareMeters: area }
  }

  async height(options: { from: PositionInput; to: PositionInput }): Promise<{ meters: number }> {
    this.context.lifecycle.assertUsable("measure height")
    const from = Cartographic.fromCartesian(toCartesian3(options.from))
    const to = Cartographic.fromCartesian(toCartesian3(options.to))
    return { meters: Math.abs(to.height - from.height) }
  }

  async verticalDistance(options: { from: PositionInput; to: PositionInput }): Promise<{ meters: number }> {
    return this.height(options)
  }

  async horizontalDistance(options: { from: PositionInput; to: PositionInput }): Promise<{ meters: number }> {
    this.context.lifecycle.assertUsable("measure horizontal distance")
    const start = Cartographic.fromCartesian(toCartesian3(options.from))
    const end = Cartographic.fromCartesian(toCartesian3(options.to))
    start.height = 0
    end.height = 0
    const geodesic = new EllipsoidGeodesic(start, end)
    return { meters: geodesic.surfaceDistance }
  }

  async heading(options: { from: PositionInput; to: PositionInput }): Promise<{ degrees: number }> {
    this.context.lifecycle.assertUsable("measure heading")
    const start = Cartographic.fromCartesian(toCartesian3(options.from))
    const end = Cartographic.fromCartesian(toCartesian3(options.to))
    const geodesic = new EllipsoidGeodesic(start, end)
    return { degrees: CesiumMath.toDegrees(geodesic.startHeading) }
  }

  async spaceAngle(options: {
    from: PositionInput
    via: PositionInput
    to: PositionInput
  }): Promise<{ degrees: number }> {
    this.context.lifecycle.assertUsable("measure space angle")
    const via = toCartesian3(options.via)
    const from = Cartesian3.subtract(toCartesian3(options.from), via, new Cartesian3())
    const to = Cartesian3.subtract(toCartesian3(options.to), via, new Cartesian3())
    return { degrees: CesiumMath.toDegrees(Cartesian3.angleBetween(from, to)) }
  }
}

export class AnalysisManager {
  readonly measure: MeasurementService
  readonly terrain: TerrainAnalysis
  readonly visibility: VisibilityAnalysis
  readonly query: SpatialQueryService
  readonly clip: ClipAnalysis
  readonly volume: VolumeAnalysis

  constructor(context: Arc3DContext) {
    this.measure = new MeasurementService(context)
    this.terrain = new TerrainAnalysis(context)
    this.visibility = new VisibilityAnalysis(context)
    this.query = new SpatialQueryService(context)
    this.clip = new ClipAnalysis(context)
    this.volume = new VolumeAnalysis(context, this.clip)
  }

  destroy(): void {
    this.visibility.destroy()
    this.volume.destroy()
    this.clip.destroy()
  }
}

export { TerrainAnalysis } from "./terrain"
export { VisibilityAnalysis } from "./visibility"
export { SpatialQueryService } from "./query"
export { ClipAnalysis } from "./clip"
export { VolumeAnalysis } from "./volume"
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
