import {
  ELLIPSOID_VERTICAL,
  WGS84_3D,
  type Arc3DContext,
  type PositionInput,
} from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3 } from "@arc3dlab/engine-cesium"
import {
  Cartesian3,
  Cartographic,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  GroundPrimitive,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
} from "cesium"
import {
  destinationLngLat,
  lineOfSightFromSamples,
  rayRangeMeters,
  viewshedEnvelope,
} from "./math"
import { sampleCartographics, toCartographic } from "./sampler"
import {
  clampSampleCount,
  mapInChunks,
  type AnalysisTaskOptions,
} from "./scheduler"
import type { AnalysisResult } from "./task"
import { createTaskExecutor, type AnalysisTaskExecutor } from "./task-executor"

/** 视线采样点，包含视线上方与地形的相对高度。 */
export interface SightPoint {
  /** 采样点经度。 */
  longitude: number
  /** 采样点纬度。 */
  latitude: number
  /** 视线在该位置的高度。 */
  lineHeight: number
  /** 地形在该位置的高度。 */
  terrainHeight: number
}

/** 通视分析结果。 */
export interface LineOfSightResult {
  /** 两端之间是否互相可见。 */
  visible: boolean
  /** 首个遮挡点的采样索引。 */
  occludedIndex?: number
  /** 视线上各采样点。 */
  samples: SightPoint[]
  /** 视线插值方式。 */
  interpolation: "ecef-chord"
}

/** 可视域中的单条射线结果。 */
export interface ViewshedRay {
  /** 射线方位角，单位为度。 */
  heading: number
  /** 该方向是否可见。 */
  visible: boolean
  /** 该方向上首个遮挡点的采样索引。 */
  occludedIndex?: number
  /** 该方向的可见范围，单位为米。 */
  rangeMeters: number
}

/** 可视域分析结果。 */
export interface ViewshedResult {
  /** 可见方向的数量。 */
  visibleCount: number
  /** 射线总数。 */
  rayCount: number
  /** 各射线结果。 */
  rays: ViewshedRay[]
  /** 观察点高度，单位为米。 */
  observerHeight: number
  /** 射线之间的间隔角度，单位为度。 */
  rayIntervalDegrees: number
  /** 视线插值方式。 */
  interpolation: "ecef-chord"
}

/** 可见性分析服务，提供通视与可视域分析能力。 */
export class VisibilityAnalysis {
  private overlay: { remove: () => void } | undefined

  /**
   * 创建可见性分析服务。
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
   * 分析两点之间的通视情况。
   * @param options - 分析选项，包含起点、终点、采样数及取消配置。
   * @returns 通视分析结果。
   */
  async lineOfSight(options: {
    from: PositionInput
    to: PositionInput
    samples?: number
    signal?: AbortSignal
    maxSamples?: number
  }): Promise<LineOfSightResult> {
    this.context.lifecycle.assertUsable("analyze line of sight")
    const count = Math.max(
      2,
      clampSampleCount(options.samples ?? 32, options.maxSamples),
    )
    const start = toCartesian3(options.from)
    const end = toCartesian3(options.to)
    const cartos: Cartographic[] = []
    const lineHeights: number[] = []
    for (let i = 0; i < count; i += 1) {
      const point = Cartesian3.lerp(
        start,
        end,
        i / (count - 1),
        new Cartesian3(),
      )
      const carto = Cartographic.fromCartesian(point)
      lineHeights.push(carto.height)
      carto.height = 0
      cartos.push(carto)
    }
    const terrain = await sampleCartographics(
      this.context,
      cartos,
      options,
      "analyze line of sight",
    )
    const pairs = terrain.map((item, index) => ({
      lineHeight: lineHeights[index],
      terrainHeight: item.height,
    }))
    const result = lineOfSightFromSamples(pairs)
    return {
      visible: result.visible,
      occludedIndex: result.occludedIndex,
      samples: terrain.map((item, index) => ({
        longitude: item.longitude,
        latitude: item.latitude,
        lineHeight: pairs[index].lineHeight,
        terrainHeight: pairs[index].terrainHeight,
      })),
      interpolation: "ecef-chord",
    }
  }

  /**
   * 分析观察点在指定半径内的可视域。
   * @param options - 分析选项，包含观察点、半径、射线数、观察高度及绘制/取消/进度配置。
   * @returns 可视域分析结果。
   */
  async viewshed(options: {
    observer: PositionInput
    radius: number
    rays?: number
    observerHeight?: number
    samples?: number
    draw?: boolean
    signal?: AbortSignal
    onProgress?: AnalysisTaskOptions["onProgress"]
    maxSamples?: number
  }): Promise<ViewshedResult> {
    this.context.lifecycle.assertUsable("analyze viewshed")
    const rayCount = Math.max(
      1,
      clampSampleCount(options.rays ?? 36, options.maxSamples),
    )
    const observerHeight = options.observerHeight ?? 2
    const sampleCount = Math.max(2, options.samples ?? 16)
    const origin = toCartographic(options.observer)
    const [sampled] = await sampleCartographics(
      this.context,
      [origin.clone()],
      options,
      "analyze viewshed",
    )
    const from: [number, number, number] = [
      sampled.longitude,
      sampled.latitude,
      sampled.height + observerHeight,
    ]
    const headings = Array.from(
      { length: rayCount },
      (_, i) => (360 * i) / rayCount,
    )
    const rays = await mapInChunks(
      headings,
      8,
      async (heading) => {
        const dest = destinationLngLat(
          from[0],
          from[1],
          heading,
          options.radius,
        )
        const sight = await this.lineOfSight({
          from,
          to: [dest.longitude, dest.latitude, sampled.height],
          samples: sampleCount,
          signal: options.signal,
        })
        return {
          heading,
          visible: sight.visible,
          occludedIndex: sight.occludedIndex,
          rangeMeters: rayRangeMeters(
            options.radius,
            sampleCount,
            sight.occludedIndex,
          ),
        }
      },
      this.context,
      "analyze viewshed",
      options,
    )
    if (options.draw) this.drawEnvelope(from[0], from[1], rays)
    return {
      visibleCount: rays.filter((ray) => ray.visible).length,
      rayCount,
      rays,
      observerHeight,
      rayIntervalDegrees: 360 / rayCount,
      interpolation: "ecef-chord",
    }
  }

  /**
   * 以任务形式分析两点之间的通视情况。
   * @param options - 分析选项，包含起点、终点、采样数及取消配置。
   * @returns 分析结果，结果值为通视分析结果。
   */
  lineOfSightTask(options: {
    from: PositionInput
    to: PositionInput
    samples?: number
    signal?: AbortSignal
    maxSamples?: number
  }): Promise<AnalysisResult<LineOfSightResult>> {
    return this.runTask<typeof options, LineOfSightResult>({
      algorithm: "visibility.lineOfSight",
      input: options,
      signal: options.signal,
      maxSamples: options.maxSamples,
      spatialReference: WGS84_3D,
      verticalReference: ELLIPSOID_VERTICAL,
      execute: async (runner) => {
        runner.throwIfCancelled("analyze line of sight")
        return {
          value: await this.lineOfSight(options),
          units: { length: "m" },
        }
      },
    })
  }

  /**
   * 以任务形式分析观察点的可视域。
   * @param options - 分析选项，包含观察点、半径、射线数、观察高度及绘制/取消/进度配置。
   * @returns 分析结果，结果值为可视域分析结果。
   */
  viewshedTask(options: {
    observer: PositionInput
    radius: number
    rays?: number
    observerHeight?: number
    samples?: number
    draw?: boolean
    signal?: AbortSignal
    onProgress?: AnalysisTaskOptions["onProgress"]
    maxSamples?: number
  }): Promise<AnalysisResult<ViewshedResult>> {
    return this.runTask<typeof options, ViewshedResult>({
      algorithm: "visibility.viewshed",
      input: options,
      signal: options.signal,
      maxSamples: options.maxSamples,
      onProgress: options.onProgress,
      spatialReference: WGS84_3D,
      verticalReference: ELLIPSOID_VERTICAL,
      execute: async (runner) => {
        runner.throwIfCancelled("analyze viewshed")
        return {
          value: await this.viewshed(options),
          units: { length: "m", angle: "deg" },
          artifacts: [{ id: "viewshed", kind: "viewshed" }],
        }
      },
    })
  }

  /** 清除可视域叠加显示。 */
  clearOverlay(): void {
    this.context.lifecycle.assertUsable("clear viewshed overlay")
    this.removeOverlay()
  }

  /** 释放可见性分析服务占用的资源。 */
  destroy(): void {
    this.removeOverlay()
  }

  private removeOverlay(): void {
    this.overlay?.remove()
    this.overlay = undefined
  }

  private drawEnvelope(
    longitude: number,
    latitude: number,
    rays: ViewshedRay[],
  ): void {
    this.removeOverlay()
    if (rays.length < 3) return
    const ring = viewshedEnvelope(longitude, latitude, rays)
    const positions = ring.map((point) =>
      Cartesian3.fromDegrees(point.longitude, point.latitude),
    )
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const primitive = new GroundPrimitive({
      geometryInstances: new GeometryInstance({
        geometry: new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(positions),
          vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(
            Color.fromBytes(115, 209, 61, 136),
          ),
        },
      }),
      appearance: new PerInstanceColorAppearance({
        translucent: true,
        flat: true,
      }),
    })
    viewer.scene.primitives.add(primitive)
    this.overlay = {
      remove: () => {
        viewer.scene.primitives.remove(primitive)
      },
    }
  }
}
