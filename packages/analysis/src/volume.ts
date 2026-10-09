import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import { Cartographic } from "cesium"
import type { ClipAnalysis } from "./clip"
import { accumulateCutFill, haversineMeters, pointInPolygon, type LngLatLike } from "./math"
import { sampleCartographics } from "./sampler"

function toLngLat(input: PositionInput): LngLatLike {
  if (Array.isArray(input)) return { longitude: input[0], latitude: input[1] }
  return { longitude: input.longitude, latitude: input.latitude }
}

export interface CutFillResult {
  cutCubicMeters: number
  fillCubicMeters: number
  designHeight: number
  sampleCount: number
}

export class VolumeAnalysis {
  constructor(
    private readonly context: Arc3DContext,
    private readonly clip: ClipAnalysis
  ) {}

  async cutFill(options: {
    positions: PositionInput[]
    samples?: number
    designHeight?: number
  }): Promise<CutFillResult> {
    this.context.lifecycle.assertUsable("analyze cut fill")
    const ring = options.positions.map(toLngLat)
    if (ring.length < 3) {
      return {
        cutCubicMeters: 0,
        fillCubicMeters: 0,
        designHeight: options.designHeight ?? 0,
        sampleCount: 0,
      }
    }

    const west = Math.min(...ring.map((point) => point.longitude))
    const east = Math.max(...ring.map((point) => point.longitude))
    const south = Math.min(...ring.map((point) => point.latitude))
    const north = Math.max(...ring.map((point) => point.latitude))
    const samples = Math.max(1, options.samples ?? 16)
    const midLat = (south + north) / 2
    const midLon = (west + east) / 2
    const width = haversineMeters({ longitude: west, latitude: midLat }, { longitude: east, latitude: midLat })
    const height = haversineMeters({ longitude: midLon, latitude: south }, { longitude: midLon, latitude: north })
    const cellArea = (width / samples) * (height / samples)

    const cartos: Cartographic[] = []
    for (let i = 0; i < samples; i += 1) {
      for (let j = 0; j < samples; j += 1) {
        const longitude = west + ((i + 0.5) / samples) * (east - west)
        const latitude = south + ((j + 0.5) / samples) * (north - south)
        if (!pointInPolygon({ longitude, latitude }, ring)) continue
        const carto = Cartographic.fromDegrees(longitude, latitude)
        carto.height = 0
        cartos.push(carto)
      }
    }

    if (cartos.length === 0) {
      return {
        cutCubicMeters: 0,
        fillCubicMeters: 0,
        designHeight: options.designHeight ?? 0,
        sampleCount: 0,
      }
    }

    const sampled = await sampleCartographics(this.context, cartos)
    const heights = sampled.map((item) => item.height)
    const designHeight =
      options.designHeight ?? heights.reduce((sum, value) => sum + value, 0) / heights.length
    const { cut, fill } = accumulateCutFill(
      heights.map((value) => value - designHeight),
      cellArea
    )
    return {
      cutCubicMeters: cut,
      fillCubicMeters: fill,
      designHeight,
      sampleCount: heights.length,
    }
  }

  async excavate(options: { positions: PositionInput[]; depth: number }): Promise<void> {
    this.context.lifecycle.assertUsable("excavate volume")
    this.clip.setExcavation({ positions: options.positions, depth: options.depth })
  }

  clear(): void {
    this.context.lifecycle.assertUsable("clear volume")
    if (this.clip.list().includes("excavation")) this.clip.clear()
  }

  destroy(): void {
  }
}
