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

export class MeasurementService {
  constructor(
    private readonly context: Arc3DContext,
    private readonly runTask: AnalysisTaskExecutor = createTaskExecutor(
      context,
    ),
  ) {}

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
}

export class AnalysisManager {
  readonly measure: MeasurementService
  readonly terrain: TerrainAnalysis
  readonly visibility: VisibilityAnalysis
  readonly query: SpatialQueryService
  readonly clip: ClipAnalysis
  readonly volume: VolumeAnalysis
  readonly tasks: AnalysisTaskRegistry

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
  }

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

  destroy(): void {
    this.visibility.destroy()
    this.volume.destroy()
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
