import { describe, expect, it, vi } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { ClipAnalysis } from "@arc3dlab/analysis"
import { ClippingPlaneCollection, ClippingPolygonCollection } from "cesium"

type FakeCollection = {
  enabled: boolean
  removeAll: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

function baselineCollection(): FakeCollection {
  return { enabled: true, removeAll: vi.fn(), destroy: vi.fn() }
}

interface GlobeHarness {
  globe: Record<string, unknown>
  state: { planes: unknown; polygons: unknown }
  writes: { planes: number; polygons: number }
}

function makeGlobe(
  initial: {
    planes?: unknown
    polygons?: unknown
  } = {},
): GlobeHarness {
  const state = { planes: initial.planes, polygons: initial.polygons }
  const writes = { planes: 0, polygons: 0 }
  const globe: Record<string, unknown> = {}
  Object.defineProperty(globe, "clippingPlanes", {
    get: () => state.planes,
    set: (value) => {
      state.planes = value
      writes.planes += 1
    },
    configurable: true,
  })
  Object.defineProperty(globe, "clippingPolygons", {
    get: () => state.polygons,
    set: (value) => {
      state.polygons = value
      writes.polygons += 1
    },
    configurable: true,
  })
  return { globe, state, writes }
}

function clip(harness: GlobeHarness) {
  const analysis = new ClipAnalysis({
    lifecycle: new LifecycleManager(),
    engine: {
      native: {
        viewer: { scene: { globe: harness.globe } },
      },
    },
  } as Arc3DContext)
  return analysis
}

function triangle(): [number, number][] {
  return [
    [120, 30],
    [120.1, 30],
    [120.1, 30.1],
  ]
}

function expectInvalidArgument(run: () => unknown): void {
  let caught: unknown
  try {
    run()
  } catch (error) {
    caught = error
  }
  expect(caught).toMatchObject({ code: "INVALID_ARGUMENT" })
}

describe("ClipAnalysis recording", () => {
  it("records a plane clip and restores the unused polygon slot to baseline", () => {
    const harness = makeGlobe()
    const analysis = clip(harness)
    analysis.setPlane({ origin: [120, 30, 0], heading: 90 })
    expect(analysis.list()).toEqual(["plane"])
    expect(harness.state.planes).toBeInstanceOf(ClippingPlaneCollection)
    expect((harness.state.planes as ClippingPlaneCollection).enabled).toBe(true)
    expect(harness.state.polygons).toBeUndefined()
  })

  it("records a box clip", () => {
    const harness = makeGlobe()
    const analysis = clip(harness)
    analysis.setBox({ west: 120, south: 30, east: 120.1, north: 30.1 })
    expect(analysis.list()).toEqual(["box"])
    expect(harness.state.planes).toBeInstanceOf(ClippingPlaneCollection)
  })

  it("records a polygon clip", () => {
    const harness = makeGlobe()
    const analysis = clip(harness)
    analysis.setPolygon({ positions: triangle() })
    expect(analysis.list()).toEqual(["polygon"])
    expect(harness.state.polygons).toBeInstanceOf(ClippingPolygonCollection)
    expect((harness.state.polygons as ClippingPolygonCollection).enabled).toBe(
      true,
    )
    expect(harness.state.planes).toBeUndefined()
  })

  it("records excavation with polygon and floor plane", () => {
    const harness = makeGlobe()
    const analysis = clip(harness)
    const result = analysis.setExcavation({
      positions: [...triangle(), [120, 30.1]],
      depth: 20,
    })
    expect(result).toEqual({
      depth: 20,
      volumetric: true,
      method: "clipping-polygon-and-floor-plane",
    })
    expect(analysis.list()).toEqual(["excavation"])
    expect((harness.state.planes as ClippingPlaneCollection).enabled).toBe(true)
    expect((harness.state.polygons as ClippingPolygonCollection).enabled).toBe(
      true,
    )
  })

  it("records a non-volumetric excavation without a floor plane", () => {
    const harness = makeGlobe()
    const analysis = clip(harness)
    const result = analysis.setExcavation({
      positions: [...triangle(), [120, 30.1]],
      depth: 0,
    })
    expect(result.volumetric).toBe(false)
    expect(analysis.list()).toEqual(["excavation"])
    expect(harness.state.planes).toBeUndefined()
    expect(harness.state.polygons).toBeInstanceOf(ClippingPolygonCollection)
  })
})

describe("ClipAnalysis invalid input", () => {
  it("rejects a polygon with fewer than three positions without touching state", () => {
    const harness = makeGlobe()
    const analysis = clip(harness)
    const writes = { ...harness.writes }
    expectInvalidArgument(() =>
      analysis.setPolygon({
        positions: [
          [120, 30],
          [120.1, 30],
        ],
      }),
    )
    expect(analysis.list()).toEqual([])
    expect(harness.writes).toEqual(writes)
    expect(harness.state.polygons).toBeUndefined()
  })

  it("keeps the previous clip when excavation input is invalid", () => {
    const harness = makeGlobe()
    const analysis = clip(harness)
    analysis.setPolygon({ positions: triangle() })
    const previousPolygons = harness.state.polygons
    const writes = { ...harness.writes }
    expectInvalidArgument(() =>
      analysis.setExcavation({ positions: [[120, 30]], depth: 5 }),
    )
    expect(analysis.list()).toEqual(["polygon"])
    expect(harness.state.polygons).toBe(previousPolygons)
    expect(harness.writes).toEqual(writes)
  })
})

describe("ClipAnalysis ownership", () => {
  it("destroys the previous owned plane collection when replaced", () => {
    const harness = makeGlobe()
    const analysis = clip(harness)
    analysis.setPlane({ origin: [120, 30, 0] })
    const first = harness.state.planes as ClippingPlaneCollection
    const destroy = vi.spyOn(first, "destroy")
    analysis.setPlane({ origin: [120.1, 30.1, 0] })
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(harness.state.planes).not.toBe(first)
  })

  it("restores the polygon baseline on clear and keeps it alive", () => {
    const baseline = baselineCollection()
    const harness = makeGlobe({ polygons: baseline })
    const analysis = clip(harness)
    analysis.setPolygon({ positions: triangle() })
    expect(harness.state.polygons).not.toBe(baseline)
    expect(baseline.destroy).not.toHaveBeenCalled()
    analysis.clear()
    expect(harness.state.polygons).toBe(baseline)
    expect(analysis.list()).toEqual([])
    expect(baseline.destroy).not.toHaveBeenCalled()
  })

  it("restores the plane baseline on destroy and releases its own collection", () => {
    const baseline = baselineCollection()
    const harness = makeGlobe({ planes: baseline })
    const analysis = clip(harness)
    analysis.setPlane({ origin: [120, 30, 0] })
    const owned = harness.state.planes as ClippingPlaneCollection
    const destroy = vi.spyOn(owned, "destroy")
    analysis.destroy()
    expect(harness.state.planes).toBe(baseline)
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(baseline.destroy).not.toHaveBeenCalled()
    expect(analysis.list()).toEqual([])
  })

  it("restores the baseline when switching clip modes", () => {
    const baselinePlanes = baselineCollection()
    const harness = makeGlobe({ planes: baselinePlanes })
    const analysis = clip(harness)
    analysis.setPolygon({ positions: triangle() })
    expect(harness.state.planes).toBe(baselinePlanes)
    analysis.setPlane({ origin: [120, 30, 0] })
    expect(analysis.list()).toEqual(["plane"])
    expect(harness.state.planes).not.toBe(baselinePlanes)
    expect(baselinePlanes.destroy).not.toHaveBeenCalled()
  })

  it("does not touch the globe when never used", () => {
    const baseline = baselineCollection()
    const harness = makeGlobe({ planes: baseline, polygons: baseline })
    const analysis = clip(harness)
    analysis.clear()
    analysis.destroy()
    expect(harness.writes).toEqual({ planes: 0, polygons: 0 })
    expect(harness.state.planes).toBe(baseline)
    expect(harness.state.polygons).toBe(baseline)
    expect(baseline.destroy).not.toHaveBeenCalled()
  })
})
