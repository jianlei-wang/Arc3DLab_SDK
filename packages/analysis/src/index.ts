import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
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

export class MeasurementService {
  constructor(private readonly context: Arc3DContext) {}

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

  async verticalDistance(options: {
    from: PositionInput
    to: PositionInput
  }): Promise<HeightResult> {
    return this.height(options)
  }

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
