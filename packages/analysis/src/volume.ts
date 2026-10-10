import {
  ELLIPSOID_VERTICAL,
  WGS84_3D,
  type Arc3DContext,
  type PositionInput,
} from "@arc3dlab/core"
import { Cartographic } from "cesium"
import type { ClipAnalysis, ExcavationResult } from "./clip"
import { toMeasurePoint } from "./geometry"
import {
  accumulateCutFillWeighted,
  buildCutFillGrid,
  estimateCutFillError,
} from "./cutfill"
import { sampleCartographics } from "./sampler"
import type { AnalysisTaskOptions } from "./scheduler"
import type { AnalysisResult } from "./task"
import { createTaskExecutor, type AnalysisTaskExecutor } from "./task-executor"

/** 土方平衡计算结果。 */
export interface CutFillResult {
  /** 挖方体积，单位为立方米。 */
  cutCubicMeters: number
  /** 填方体积，单位为立方米。 */
  fillCubicMeters: number
  /** 设计高程，单位为米。 */
  designHeight: number
  /** 采样点数量。 */
  sampleCount: number
  /** 网格分辨率，单位为米。 */
  resolutionMeters: number
  /** 估算误差体积，单位为立方米。 */
  estimatedErrorCubicMeters: number
}

/** 体积分析服务，提供土方平衡计算与开挖能力。 */
export class VolumeAnalysis {
  /**
   * 创建体积分析服务。
   * @param context - Arc3D 运行上下文。
   * @param clip - 裁剪分析服务，用于执行开挖。
   * @param runTask - 任务执行器，默认绑定当前上下文。
   */
  constructor(
    private readonly context: Arc3DContext,
    private readonly clip: ClipAnalysis,
    private readonly runTask: AnalysisTaskExecutor = createTaskExecutor(
      context,
    ),
  ) {}

  /**
   * 计算多边形范围内的土方挖填量。
   * @param options - 计算选项，包含多边形、采样数、设计高程与取消/进度配置。
   * @returns 土方平衡计算结果。
   */
  async cutFill(options: {
    positions: PositionInput[]
    samples?: number
    designHeight?: number
    signal?: AbortSignal
    onProgress?: AnalysisTaskOptions["onProgress"]
    maxSamples?: number
  }): Promise<CutFillResult> {
    this.context.lifecycle.assertUsable("analyze cut fill")
    const ring = options.positions.map(toMeasurePoint)
    if (ring.length < 3) {
      return {
        cutCubicMeters: 0,
        fillCubicMeters: 0,
        designHeight: options.designHeight ?? 0,
        sampleCount: 0,
        resolutionMeters: 0,
        estimatedErrorCubicMeters: 0,
      }
    }

    const sampleCap = options.maxSamples ?? 10_000
    const samples = Math.max(
      1,
      Math.min(options.samples ?? 16, Math.floor(Math.sqrt(sampleCap))),
    )
    const grid = buildCutFillGrid(ring, samples)
    if (grid.cells.length === 0) {
      return {
        cutCubicMeters: 0,
        fillCubicMeters: 0,
        designHeight: options.designHeight ?? 0,
        sampleCount: 0,
        resolutionMeters: grid.resolutionMeters,
        estimatedErrorCubicMeters: 0,
      }
    }

    const cartos = grid.cells.map((cell) => {
      const carto = Cartographic.fromDegrees(cell.longitude, cell.latitude)
      carto.height = 0
      return carto
    })
    const sampled = await sampleCartographics(
      this.context,
      cartos,
      { signal: options.signal, onProgress: options.onProgress },
      "analyze cut fill",
    )
    const heights = sampled.map((item) => item.height)
    const designHeight =
      options.designHeight ??
      heights.reduce((sum, value) => sum + value, 0) / heights.length
    const deltas = heights.map((value) => value - designHeight)
    const { cut, fill } = accumulateCutFillWeighted(
      deltas.map((delta, index) => ({
        delta,
        area: grid.cells[index].areaSquareMeters,
      })),
    )
    return {
      cutCubicMeters: cut,
      fillCubicMeters: fill,
      designHeight,
      sampleCount: heights.length,
      resolutionMeters: grid.resolutionMeters,
      estimatedErrorCubicMeters: estimateCutFillError(grid.cells, deltas),
    }
  }

  /**
   * 按多边形与深度执行开挖。
   * @param options - 开挖选项，包含多边形顶点与深度。
   * @returns 开挖结果。
   */
  async excavate(options: {
    positions: PositionInput[]
    depth: number
  }): Promise<ExcavationResult> {
    this.context.lifecycle.assertUsable("excavate volume")
    return this.clip.setExcavation({
      positions: options.positions,
      depth: options.depth,
    })
  }

  /**
   * 以任务形式计算土方挖填量。
   * @param options - 计算选项，包含多边形、采样数、设计高程与取消/进度配置。
   * @returns 分析结果，结果值为土方平衡计算结果。
   */
  cutFillTask(options: {
    positions: PositionInput[]
    samples?: number
    designHeight?: number
    signal?: AbortSignal
    onProgress?: AnalysisTaskOptions["onProgress"]
    maxSamples?: number
  }): Promise<AnalysisResult<CutFillResult>> {
    return this.runTask<typeof options, CutFillResult>({
      algorithm: "volume.cutFill",
      input: options,
      signal: options.signal,
      maxSamples: options.maxSamples,
      onProgress: options.onProgress,
      spatialReference: WGS84_3D,
      verticalReference: ELLIPSOID_VERTICAL,
      execute: async (runner) => {
        runner.throwIfCancelled("analyze cut fill")
        return {
          value: await this.cutFill(options),
          units: { volume: "m3", length: "m" },
          artifacts: [{ id: "cutfill", kind: "volume" }],
        }
      },
    })
  }

  /** 清除本服务产生的开挖裁剪效果。 */
  clear(): void {
    this.context.lifecycle.assertUsable("clear volume")
    if (this.clip.list().includes("excavation")) this.clip.clear()
  }

  /** 释放体积分析服务占用的资源。 */
  destroy(): void {}
}
