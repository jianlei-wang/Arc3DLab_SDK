import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3 } from "@arc3dlab/engine-cesium"
import { Cartographic, Math as CesiumMath } from "cesium"
import {
  afterAnalysisAwait,
  clampSampleCount,
  throwIfCancelled,
  type AnalysisTaskOptions,
} from "./scheduler"

/** 地形高程的来源类型。 */
export type TerrainHeightSource = "sampleHeight" | "globe" | "ellipsoid"
/** 地形采样的状态。 */
export type TerrainSampleStatus =
  "sampled" | "fallback" | "unavailable" | "cancelled"

/** 单个位置的地形采样结果。 */
export interface SampledHeight {
  /** 采样点经度。 */
  longitude: number
  /** 采样点纬度。 */
  latitude: number
  /** 采样得到的高程，单位为米。 */
  height: number
  /** 高程来源。 */
  source: TerrainHeightSource
  /** 采样状态。 */
  status: TerrainSampleStatus
}

/**
 * 根据不同来源的采样值解析最终使用的地形高程。
 * @param input - 采样输入，包含详细高程与球面高程。
 * @returns 解析得到的高程、来源与状态。
 */
export function resolveTerrainSample(input: {
  sampleHeightSupported: boolean
  detailedHeight?: number | null
  globeHeight?: number | null
}): Omit<SampledHeight, "longitude" | "latitude"> {
  if (input.sampleHeightSupported && Number.isFinite(input.detailedHeight)) {
    return {
      height: input.detailedHeight as number,
      source: "sampleHeight",
      status: "sampled",
    }
  }
  if (Number.isFinite(input.globeHeight)) {
    return {
      height: input.globeHeight as number,
      source: "globe",
      status: input.sampleHeightSupported ? "fallback" : "sampled",
    }
  }
  return { height: 0, source: "ellipsoid", status: "unavailable" }
}

/**
 * 将位置输入转换为 Cesium 经纬度坐标对象。
 * @param input - 位置输入。
 * @returns 对应的 Cesium 经纬度坐标。
 */
export function toCartographic(input: PositionInput): Cartographic {
  return Cartographic.fromCartesian(toCartesian3(input))
}

/**
 * 批量采样指定位置的详细地形高程。
 * @param context - Arc3D 运行上下文。
 * @param cartos - 待采样的经纬度坐标列表。
 * @param options - 采样选项，包含取消信号与最大采样数。
 * @param action - 操作描述，用于取消与错误提示。
 * @returns 采样结果列表。
 */
export async function sampleCartographics(
  context: Arc3DContext,
  cartos: Cartographic[],
  options?: AnalysisTaskOptions,
  action = "sample terrain",
): Promise<SampledHeight[]> {
  throwIfCancelled(context, options?.signal, action)
  const viewer = getCesiumViewer(context.engine.native.viewer)
  if (cartos.length === 0) return []
  const limited = cartos.slice(
    0,
    clampSampleCount(cartos.length, options?.maxSamples ?? cartos.length),
  )
  const clones = limited.map((item) => item.clone())
  const supported = Boolean(viewer.scene.sampleHeightSupported)
  let detailed: Array<Cartographic | undefined> | undefined
  if (supported) {
    detailed = await afterAnalysisAwait(
      context,
      options?.signal,
      action,
      await viewer.scene.sampleHeightMostDetailed(clones),
    )
  }
  return limited.map((item, index) => {
    const clone = clones[index]
    const globeHeight = viewer.scene.globe.getHeight(clone)
    const resolved = resolveTerrainSample({
      sampleHeightSupported: supported,
      detailedHeight: detailed?.[index]?.height,
      globeHeight,
    })
    return {
      longitude: CesiumMath.toDegrees(item.longitude),
      latitude: CesiumMath.toDegrees(item.latitude),
      ...resolved,
    }
  })
}

/**
 * 返回当前上下文可用的地形高程来源类型。
 * @param context - Arc3D 运行上下文。
 * @returns 地形高程来源类型。
 */
export function sampleSource(context: Arc3DContext): TerrainHeightSource {
  const viewer = getCesiumViewer(context.engine.native.viewer)
  return viewer.scene.sampleHeightSupported ? "sampleHeight" : "globe"
}
