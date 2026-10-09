import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3 } from "@arc3dlab/engine-cesium"
import { Cartographic, Math as CesiumMath } from "cesium"
import {
  afterAnalysisAwait,
  clampSampleCount,
  throwIfCancelled,
  type AnalysisTaskOptions,
} from "./scheduler"

export type TerrainHeightSource = "sampleHeight" | "globe" | "ellipsoid"
export type TerrainSampleStatus = "sampled" | "fallback" | "unavailable" | "cancelled"

export interface SampledHeight {
  longitude: number
  latitude: number
  height: number
  source: TerrainHeightSource
  status: TerrainSampleStatus
}

export function resolveTerrainSample(input: {
  sampleHeightSupported: boolean
  detailedHeight?: number | null
  globeHeight?: number | null
}): Omit<SampledHeight, "longitude" | "latitude"> {
  if (input.sampleHeightSupported && Number.isFinite(input.detailedHeight)) {
    return { height: input.detailedHeight as number, source: "sampleHeight", status: "sampled" }
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

export function toCartographic(input: PositionInput): Cartographic {
  return Cartographic.fromCartesian(toCartesian3(input))
}

export async function sampleCartographics(
  context: Arc3DContext,
  cartos: Cartographic[],
  options?: AnalysisTaskOptions,
  action = "sample terrain"
): Promise<SampledHeight[]> {
  throwIfCancelled(context, options?.signal, action)
  const viewer = getCesiumViewer(context.engine.native.viewer)
  if (cartos.length === 0) return []
  const limited = cartos.slice(
    0,
    clampSampleCount(cartos.length, options?.maxSamples ?? cartos.length)
  )
  const clones = limited.map((item) => item.clone())
  const supported = Boolean(viewer.scene.sampleHeightSupported)
  let detailed: Array<Cartographic | undefined> | undefined
  if (supported) {
    detailed = await afterAnalysisAwait(
      context,
      options?.signal,
      action,
      await viewer.scene.sampleHeightMostDetailed(clones)
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

export function sampleSource(context: Arc3DContext): TerrainHeightSource {
  const viewer = getCesiumViewer(context.engine.native.viewer)
  return viewer.scene.sampleHeightSupported ? "sampleHeight" : "globe"
}
