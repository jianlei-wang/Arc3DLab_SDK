import type { Arc3DContext, LngLatHeight, PositionInput } from "@arc3dlab/core"
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

export interface HeightSample extends LngLatHeight {
  source: TerrainHeightSource
  status: TerrainSampleStatus
}

export interface SlopeResult extends HeightSample {
  slopeDegrees: number
  aspectDegrees: number
  sampleMeters: number
}

export interface ProfilePoint extends LngLatHeight {
  distance: number
}

export class TerrainAnalysis {
  constructor(private readonly context: Arc3DContext) {}

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

  setExaggeration(scale: number): void {
    this.context.lifecycle.assertUsable("set terrain exaggeration")
    getCesiumViewer(
      this.context.engine.native.viewer,
    ).scene.verticalExaggeration = scale
  }

  getExaggeration(): number {
    this.context.lifecycle.assertUsable("get terrain exaggeration")
    return getCesiumViewer(this.context.engine.native.viewer).scene
      .verticalExaggeration
  }
}
