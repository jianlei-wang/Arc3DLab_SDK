import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { ClipAnalysis, VolumeAnalysis } from "@arc3dlab/analysis"
import { Cartographic } from "cesium"

function volume(heightAt: (longitude: number, latitude: number) => number) {
  const globe = {
    clippingPlanes: { enabled: false, removeAll() {}, destroy() {} },
    clippingPolygons: { enabled: false, removeAll() {} },
    getHeight(carto: Cartographic) {
      return heightAt(
        (carto.longitude * 180) / Math.PI,
        (carto.latitude * 180) / Math.PI,
      )
    },
  }
  const context = {
    lifecycle: new LifecycleManager(),
    engine: {
      native: {
        viewer: {
          scene: {
            sampleHeightSupported: false,
            globe,
          },
        },
      },
    },
  } as Arc3DContext
  const clip = new ClipAnalysis(context)
  return { analysis: new VolumeAnalysis(context, clip), clip, globe }
}

const pit = [
  [120.0, 30.0],
  [120.02, 30.0],
  [120.02, 30.02],
  [120.0, 30.02],
] as [number, number][]

describe("VolumeAnalysis", () => {
  it("reports cut when terrain sits above the design height", async () => {
    const { analysis } = volume(() => 100)
    const result = await analysis.cutFill({
      positions: pit,
      samples: 8,
      designHeight: 90,
    })
    expect(result.sampleCount).toBeGreaterThan(0)
    expect(result.cutCubicMeters).toBeGreaterThan(0)
    expect(result.fillCubicMeters).toBe(0)
    expect(result.designHeight).toBe(90)
    expect(result.resolutionMeters).toBeGreaterThan(0)
    expect(result.estimatedErrorCubicMeters).toBeGreaterThanOrEqual(0)
    expect(result.status).toBe("computed")
    expect(result.terrain).toEqual({
      sampled: result.sampleCount,
      fallback: 0,
      unavailable: 0,
    })
  })

  it("flags degenerate polygons instead of silently reporting zero", async () => {
    const { analysis } = volume(() => 100)
    const result = await analysis.cutFill({
      positions: [
        [120.0, 30.0],
        [120.02, 30.0],
      ],
      samples: 8,
    })
    expect(result.status).toBe("invalid-polygon")
    expect(result.sampleCount).toBe(0)
    expect(result.cutCubicMeters).toBe(0)
    expect(result.fillCubicMeters).toBe(0)
    expect(result.estimatedErrorCubicMeters).toBe(0)
  })

  it("reports an empty grid for a collinear ring", async () => {
    const { analysis } = volume(() => 100)
    const result = await analysis.cutFill({
      positions: [
        [120.0, 30.0],
        [120.02, 30.0],
        [120.04, 30.0],
      ],
      samples: 8,
    })
    expect(result.status).toBe("empty-grid")
    expect(result.sampleCount).toBe(0)
    expect(Number.isFinite(result.cutCubicMeters)).toBe(true)
  })

  it("reports fill when terrain sits below the design height", async () => {
    const { analysis } = volume(() => 80)
    const result = await analysis.cutFill({
      positions: pit,
      samples: 8,
      designHeight: 100,
    })
    expect(result.fillCubicMeters).toBeGreaterThan(0)
    expect(result.cutCubicMeters).toBe(0)
  })

  it("reports unavailable terrain instead of presenting fallback zero as measured", async () => {
    const { analysis } = volume(() => Number.NaN)
    const result = await analysis.cutFill({
      positions: pit,
      samples: 8,
    })
    expect(result.status).toBe("computed")
    expect(result.cutCubicMeters).toBe(0)
    expect(result.fillCubicMeters).toBe(0)
    expect(result.terrain).toEqual({
      sampled: 0,
      fallback: 0,
      unavailable: result.sampleCount,
    })
  })

  it("excavates through clip polygon and floor plane", async () => {
    const { analysis, clip, globe } = volume(() => 0)
    await analysis.excavate({ positions: pit, depth: 25 })
    expect(clip.list()).toEqual(["excavation"])
    expect(globe.clippingPlanes.enabled).toBe(true)
    expect(globe.clippingPolygons.enabled).toBe(true)
    analysis.clear()
    expect(clip.list()).toEqual([])
  })

  it("treats zero-depth excavation as surface clip", async () => {
    const { analysis, globe } = volume(() => 0)
    const result = await analysis.excavate({ positions: pit, depth: 0 })
    expect(result.volumetric).toBe(false)
    expect(result.method).toBe("clipping-polygon-and-floor-plane")
    expect(globe.clippingPolygons.enabled).toBe(true)
  })
})
