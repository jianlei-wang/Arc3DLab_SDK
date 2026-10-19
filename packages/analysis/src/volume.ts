import {
  Arc3DError,
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
  estimateCutFillError,
  type CutFillGrid,
} from "./cutfill"
import { sampleCartographics } from "./sampler"
import {
  DEFAULT_MAX_SAMPLES,
  resolveSampleCount,
  type AnalysisTaskOptions,
} from "./scheduler"
import type { AnalysisResult } from "./task"
import { createTaskExecutor, type AnalysisTaskExecutor } from "./task-executor"

/** 土方计算默认的单边采样数量。 */
const DEFAULT_CUT_FILL_SAMPLES = 16

/**
 * 校验并解析土方计算参数。
 * @param options - 调用方传入的采样数量、采样上限与设计高程。
 * @returns 有效的单边采样数量与设计高程。
 * @throws {Arc3DError} 任一参数不是有限数值或超出允许范围时抛出。
 */
function resolveCutFillParameters(options: {
  samples?: number
  maxSamples?: number
  designHeight?: number
}): { samples: number; designHeight?: number } {
  const sampleCap = resolveSampleCount(
    options.maxSamples,
    DEFAULT_MAX_SAMPLES,
    "maxSamples",
  )
  const requested = resolveSampleCount(
    options.samples,
    DEFAULT_CUT_FILL_SAMPLES,
    "samples",
  )
  const designHeight = options.designHeight
  if (designHeight !== undefined && !Number.isFinite(designHeight)) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `designHeight must be a finite number: ${designHeight}`,
    )
  }
  return {
    samples: Math.min(requested, Math.floor(Math.sqrt(sampleCap))),
    designHeight,
  }
}

/**
 * 确保计算结果中的数值字段均为有限数。
 * @param result - 状态为 `computed` 的土方计算结果。
 * @throws {Arc3DError} 任一数值字段不是有限数时抛出。
 */
function assertFiniteCutFillResult(result: CutFillResult): void {
  const fields: Array<[string, number]> = [
    ["cutCubicMeters", result.cutCubicMeters],
    ["fillCubicMeters", result.fillCubicMeters],
    ["designHeight", result.designHeight],
    ["sampleCount", result.sampleCount],
    ["resolutionMeters", result.resolutionMeters],
    ["estimatedErrorCubicMeters", result.estimatedErrorCubicMeters],
  ]
  for (const [name, value] of fields) {
    if (!Number.isFinite(value)) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Cut fill produced a non-finite ${name}`,
      )
    }
  }
}

/** 土方计算状态，用于区分正常结果与非法/退化输入。 */
export type CutFillStatus = "computed" | "invalid-polygon" | "empty-grid"

/**
 * 地形数据质量。
 *
 * - `complete`：所有采样点均得到真实地形高程。
 * - `partial`：部分采样点回退到球面高程，结果仍为数值但精度下降。
 * - `degraded`：存在无地形数据的采样点，这些点按椭球高 0 参与计算，
 *   结果只能作为降级参考，不能当作真实地形量。
 */
export type CutFillTerrainQuality = "complete" | "partial" | "degraded"

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
  /**
   * 估算误差体积，单位为立方米。
   * 该值为边界单元被部分覆盖时按经验量级累计的指标，并非数学误差上界。
   */
  estimatedErrorCubicMeters: number
  /** 计算状态，非 `computed` 时各体积字段为 0。 */
  status: CutFillStatus
  /**
   * 地形采样来源统计。
   *
   * `unavailable` 表示该采样点没有可用地形高程，计算回退为椭球高 0；
   * 体积结果需结合该计数判读，避免把回退值当作真实地形。
   */
  terrain: {
    /** 使用真实地形采样的点数。 */
    sampled: number
    /** 使用回退高程的点数。 */
    fallback: number
    /** 无可用地形、按椭球高 0 计算的点数。 */
    unavailable: number
    /** 根据采样来源统计得到的数据质量。 */
    quality: CutFillTerrainQuality
  }
}

function summarizeTerrain(
  samples: Array<{ status: string }>,
): CutFillResult["terrain"] {
  const summary = {
    sampled: 0,
    fallback: 0,
    unavailable: 0,
    quality: "complete" as CutFillTerrainQuality,
  }
  for (const sample of samples) {
    if (sample.status === "sampled") summary.sampled += 1
    else if (sample.status === "fallback") summary.fallback += 1
    else if (sample.status === "unavailable") summary.unavailable += 1
  }
  if (summary.unavailable > 0) summary.quality = "degraded"
  else if (summary.fallback > 0) summary.quality = "partial"
  return summary
}

/** 生成与地形质量对应的任务警告。 */
function terrainWarnings(terrain: CutFillResult["terrain"]): string[] {
  if (terrain.quality === "complete") return []
  if (terrain.quality === "degraded") {
    return [
      `Cut fill terrain is incomplete: ${terrain.unavailable} of ${
        terrain.sampled + terrain.fallback + terrain.unavailable
      } samples had no terrain height and were treated as ellipsoid height 0.`,
    ]
  }
  return [
    `Cut fill terrain used fallback heights for ${terrain.fallback} of ${
      terrain.sampled + terrain.fallback + terrain.unavailable
    } samples; accuracy is lower than fully sampled terrain.`,
  ]
}

function emptyTerrain(): CutFillResult["terrain"] {
  return { sampled: 0, fallback: 0, unavailable: 0, quality: "complete" }
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
    const parameters = resolveCutFillParameters(options)
    const ring = options.positions.map(toMeasurePoint)
    if (ring.length < 3) {
      return {
        cutCubicMeters: 0,
        fillCubicMeters: 0,
        designHeight: parameters.designHeight ?? 0,
        sampleCount: 0,
        resolutionMeters: 0,
        estimatedErrorCubicMeters: 0,
        status: "invalid-polygon",
        terrain: emptyTerrain(),
      }
    }

    const grid = await this.buildGrid(
      options.positions,
      parameters.samples,
      options.signal,
    )
    if (grid.cells.length === 0) {
      return {
        cutCubicMeters: 0,
        fillCubicMeters: 0,
        designHeight: parameters.designHeight ?? 0,
        sampleCount: 0,
        resolutionMeters: grid.resolutionMeters,
        estimatedErrorCubicMeters: 0,
        status: "empty-grid",
        terrain: emptyTerrain(),
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
      parameters.designHeight ??
      heights.reduce((sum, value) => sum + value, 0) / heights.length
    const deltas = heights.map((value) => value - designHeight)
    const { cut, fill } = accumulateCutFillWeighted(
      deltas.map((delta, index) => ({
        delta,
        area: grid.cells[index].areaSquareMeters,
      })),
    )
    const result: CutFillResult = {
      cutCubicMeters: cut,
      fillCubicMeters: fill,
      designHeight,
      sampleCount: heights.length,
      resolutionMeters: grid.resolutionMeters,
      estimatedErrorCubicMeters: estimateCutFillError(grid.cells, deltas),
      status: "computed",
      terrain: summarizeTerrain(sampled),
    }
    assertFiniteCutFillResult(result)
    return result
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
    resolveCutFillParameters(options)
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
        const value = await this.cutFill(options)
        return {
          value,
          units: { volume: "m3", length: "m" },
          warnings: terrainWarnings(value.terrain),
          artifacts: [{ id: "cutfill", kind: "volume" }],
        }
      },
    })
  }

  /**
   * 通过统一作业路由生成土方网格。
   *
   * 网格构建只依赖纯几何计算，因此可投递到分析 Worker；后续地形采样仍在本
   * 方法内于主线程完成。
   *
   * @param positions - 多边形顶点。
   * @param samples - 单边采样数量。
   * @param signal - 取消信号。
   * @returns 土方计算网格。
   */
  private async buildGrid(
    positions: PositionInput[],
    samples: number,
    signal?: AbortSignal,
  ): Promise<CutFillGrid> {
    const { grid } = await this.runTask.runJob<{
      type: "cutfill-grid"
      grid: CutFillGrid
    }>({ type: "cutfill-grid", polygon: positions, samples }, { signal })
    return grid
  }

  /** 清除本服务产生的开挖裁剪效果。 */
  clear(): void {
    this.context.lifecycle.assertUsable("clear volume")
    if (this.clip.list().includes("excavation")) this.clip.clear()
  }

  /** 释放体积分析服务占用的资源。 */
  destroy(): void {}
}
