import {
  ELLIPSOID_VERTICAL,
  WGS84_3D,
  type Arc3DContext,
  type LngLatHeight,
  type PositionInput,
} from "@arc3dlab/core"
import { EllipsoidGeodesic } from "cesium"
import { destinationLngLat, slopeFromHeights } from "./math"
import {
  sampleCartographics,
  toCartographic,
  type TerrainHeightSource,
  type TerrainSampleStatus,
} from "./sampler"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  clampSampleCount,
  throwIfCancelled,
  type AnalysisTaskOptions,
} from "./scheduler"
import type { AnalysisResult } from "./task"
import { createTaskExecutor, type AnalysisTaskExecutor } from "./task-executor"

/** 地形高度采样结果，附加来源与状态信息。 */
export interface HeightSample extends LngLatHeight {
  /** 高程来源。 */
  source: TerrainHeightSource
  /** 采样状态。 */
  status: TerrainSampleStatus
}

/** 地形坡度采样结果。 */
export interface SlopeResult extends HeightSample {
  /** 坡度，单位为度。 */
  slopeDegrees: number
  /** 坡向，单位为度。 */
  aspectDegrees: number
  /** 采样间距，单位为米。 */
  sampleMeters: number
}

/** 地形剖面采样点，附加沿剖面起点的距离。 */
export interface ProfilePoint extends LngLatHeight {
  /** 沿剖面起点到该点的距离，单位为米。 */
  distance: number
}

/** 地形分析服务，提供高程、坡度与剖面采样能力。 */
export class TerrainAnalysis {
  /**
   * 创建地形分析服务。
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
   * 采样指定位置的地形高程。
   * @param options - 采样选项，包含位置与取消信号。
   * @returns 地形高度采样结果。
   */
  async sampleHeight(options: {
    position: PositionInput
    signal?: AbortSignal
  }): Promise<HeightSample> {
    this.context.lifecycle.assertUsable("sample terrain height")
    throwIfCancelled(this.context, options.signal, "sample terrain height")
    const carto = toCartographic(options.position)
    carto.height = 0
    const [sampled] = await sampleCartographics(
      this.context,
      [carto],
      options,
      "sample terrain height",
    )
    return {
      longitude: sampled.longitude,
      latitude: sampled.latitude,
      height: sampled.height,
      source: sampled.source,
      status: sampled.status,
    }
  }

  /**
   * 采样指定位置的坡度与坡向。
   * @param options - 采样选项，包含位置、采样间距与取消信号。
   * @returns 坡度采样结果。
   */
  async slope(options: {
    position: PositionInput
    sampleMeters?: number
    signal?: AbortSignal
  }): Promise<SlopeResult> {
    this.context.lifecycle.assertUsable("sample terrain slope")
    const sampleMeters = options.sampleMeters ?? 20
    const center = await this.sampleHeight({
      position: options.position,
      signal: options.signal,
    })
    const east = destinationLngLat(
      center.longitude,
      center.latitude,
      90,
      sampleMeters,
    )
    const north = destinationLngLat(
      center.longitude,
      center.latitude,
      0,
      sampleMeters,
    )
    const [eastH, northH] = await Promise.all([
      this.sampleHeight({
        position: [east.longitude, east.latitude],
        signal: options.signal,
      }),
      this.sampleHeight({
        position: [north.longitude, north.latitude],
        signal: options.signal,
      }),
    ])
    const grade = slopeFromHeights(
      center.height,
      eastH.height,
      northH.height,
      sampleMeters,
    )
    return { ...center, ...grade, sampleMeters }
  }

  /**
   * 沿折线路径采样地形剖面。
   * @param options - 剖面选项，包含折线顶点、采样数及取消/进度配置。
   * @returns 剖面上的采样点列表。
   */
  async profile(options: {
    positions: PositionInput[]
    samples?: number
    signal?: AbortSignal
    onProgress?: AnalysisTaskOptions["onProgress"]
    maxSamples?: number
  }): Promise<{
    points: ProfilePoint[]
  }> {
    this.context.lifecycle.assertUsable("sample terrain profile")
    throwIfCancelled(this.context, options.signal, "sample terrain profile")
    const samples = Math.max(
      2,
      clampSampleCount(options.samples ?? 32, options.maxSamples),
    )
    const inputs = options.positions
    if (inputs.length < 2) {
      const only = inputs[0]
        ? await this.sampleHeight({ position: inputs[0] })
        : undefined
      return { points: only ? [{ ...only, distance: 0 }] : [] }
    }

    const segments = []
    let total = 0
    for (let i = 0; i < inputs.length - 1; i += 1) {
      const start = toCartographic(inputs[i])
      const end = toCartographic(inputs[i + 1])
      start.height = 0
      end.height = 0
      const geodesic = new EllipsoidGeodesic(start, end)
      segments.push({
        geodesic,
        length: geodesic.surfaceDistance,
        startDistance: total,
      })
      total += geodesic.surfaceDistance
    }

    const cartos = []
    const distances: number[] = []
    for (let s = 0; s < samples; s += 1) {
      const along = total === 0 ? 0 : (s / (samples - 1)) * total
      const segment =
        segments.find((item) => along <= item.startDistance + item.length) ??
        segments[segments.length - 1]
      const remaining = along - segment.startDistance
      const fraction =
        segment.length === 0 ? 0 : Math.min(1, remaining / segment.length)
      cartos.push(segment.geodesic.interpolateUsingFraction(fraction))
      distances.push(along)
    }

    const sampled = await sampleCartographics(
      this.context,
      cartos,
      options,
      "sample terrain profile",
    )
    return {
      points: sampled.map((item, index) => ({
        longitude: item.longitude,
        latitude: item.latitude,
        height: item.height,
        distance: distances[index],
      })),
    }
  }

  /**
   * 以任务形式采样地形高程。
   * @param options - 采样选项，包含位置与取消信号。
   * @returns 分析结果，结果值为地形高度采样结果。
   */
  sampleHeightTask(options: {
    position: PositionInput
    signal?: AbortSignal
  }): Promise<AnalysisResult<HeightSample>> {
    return this.runTask<typeof options, HeightSample>({
      algorithm: "terrain.sampleHeight",
      input: options,
      signal: options.signal,
      spatialReference: WGS84_3D,
      verticalReference: ELLIPSOID_VERTICAL,
      execute: async (runner) => {
        runner.throwIfCancelled("sample terrain height")
        return {
          value: await this.sampleHeight(options),
          units: { length: "m" },
        }
      },
    })
  }

  /**
   * 以任务形式采样地形坡度。
   * @param options - 采样选项，包含位置、采样间距与取消信号。
   * @returns 分析结果，结果值为坡度采样结果。
   */
  slopeTask(options: {
    position: PositionInput
    sampleMeters?: number
    signal?: AbortSignal
  }): Promise<AnalysisResult<SlopeResult>> {
    return this.runTask<typeof options, SlopeResult>({
      algorithm: "terrain.slope",
      input: options,
      signal: options.signal,
      spatialReference: WGS84_3D,
      verticalReference: ELLIPSOID_VERTICAL,
      execute: async (runner) => {
        runner.throwIfCancelled("sample terrain slope")
        return {
          value: await this.slope(options),
          units: { length: "m", angle: "deg" },
        }
      },
    })
  }

  /**
   * 以任务形式采样地形剖面。
   * @param options - 剖面选项，包含折线顶点、采样数及取消/进度配置。
   * @returns 分析结果，结果值为剖面上的采样点列表。
   */
  profileTask(options: {
    positions: PositionInput[]
    samples?: number
    signal?: AbortSignal
    onProgress?: AnalysisTaskOptions["onProgress"]
    maxSamples?: number
  }): Promise<AnalysisResult<{ points: ProfilePoint[] }>> {
    return this.runTask<typeof options, { points: ProfilePoint[] }>({
      algorithm: "terrain.profile",
      input: options,
      signal: options.signal,
      maxSamples: options.maxSamples,
      onProgress: options.onProgress,
      spatialReference: WGS84_3D,
      verticalReference: ELLIPSOID_VERTICAL,
      execute: async (runner) => {
        runner.throwIfCancelled("sample terrain profile")
        const value = await this.profile(options)
        return {
          value,
          units: { length: "m" },
          artifacts: [{ id: "profile", kind: "profile" }],
        }
      },
    })
  }

  /**
   * 设置地形垂直夸张比例。
   * @param scale - 垂直夸张比例。
   */
  setExaggeration(scale: number): void {
    this.context.lifecycle.assertUsable("set terrain exaggeration")
    getCesiumViewer(
      this.context.engine.native.viewer,
    ).scene.verticalExaggeration = scale
  }

  /**
   * 获取当前地形垂直夸张比例。
   * @returns 垂直夸张比例。
   */
  getExaggeration(): number {
    this.context.lifecycle.assertUsable("get terrain exaggeration")
    return getCesiumViewer(this.context.engine.native.viewer).scene
      .verticalExaggeration
  }
}
