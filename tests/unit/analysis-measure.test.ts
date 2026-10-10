import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { MeasurementService } from "@arc3dlab/analysis"

function measure(): MeasurementService {
  return new MeasurementService({
    lifecycle: new LifecycleManager(),
  } as Arc3DContext)
}

describe("MeasurementService", () => {
  it("returns zero distance for a single point", async () => {
    const result = await measure().distance({ positions: [[120, 30]] })
    expect(result.meters).toBe(0)
  })

  it("computes height as ellipsoid height difference", async () => {
    const result = await measure().height({
      from: [120, 30, 10],
      to: [120, 30, 110],
    })
    expect(result.meters).toBeCloseTo(100, 5)
  })

  it("aliases verticalDistance to height", async () => {
    const result = await measure().verticalDistance({
      from: [104, 30.6, 0],
      to: [104, 30.6, 50],
    })
    expect(result.meters).toBeCloseTo(50, 5)
  })

  it("computes eastward heading near 90 degrees", async () => {
    const result = await measure().heading({
      from: [120, 30],
      to: [121, 30],
    })
    expect(result.degrees).toBeGreaterThan(80)
    expect(result.degrees).toBeLessThan(100)
  })

  it("returns zero area for fewer than 3 positions", async () => {
    const result = await measure().area({
      positions: [
        [120, 30],
        [121, 30],
      ],
    })
    expect(result.squareMeters).toBe(0)
  })

  it("computes a positive planar area for a triangle", async () => {
    const result = await measure().area({
      positions: [
        [120.0, 30.0],
        [120.1, 30.0],
        [120.0, 30.1],
      ],
    })
    expect(result.squareMeters).toBeGreaterThan(0)
  })

  it("computes space angle at a right-angle vertex", async () => {
    const result = await measure().spaceAngle({
      from: [120, 30, 0],
      via: [120, 30, 100],
      to: [120.001, 30, 100],
    })
    expect(result.degrees).toBeGreaterThan(70)
    expect(result.degrees).toBeLessThan(110)
  })

  it("uses cartesian ECEF distance and ellipsoid height datum", async () => {
    const result = await measure().distance({
      positions: [
        [120, 30, 0],
        [120, 30, 1000],
      ],
    })
    expect(result.meters).toBeCloseTo(1000, 0)
    expect(result.units).toBe("meters")
    expect(result.mode).toBe("cartesian")
    expect(result.heightDatum).toBe("ellipsoid")
  })

  it("treats missing height as zero", async () => {
    const result = await measure().distance({
      positions: [
        [120, 30],
        [120, 30, 0],
      ],
    })
    expect(result.meters).toBeCloseTo(0, 5)
  })

  it("computes geodesic horizontal distance near one degree at the equator", async () => {
    const result = await measure().horizontalDistance({
      from: [0, 0, 500],
      to: [1, 0, 1500],
    })
    expect(result.meters).toBeCloseTo(111319.5, 0)
    expect(result.mode).toBe("geodesic")
  })

  it("wraps westward heading to 270 degrees", async () => {
    const result = await measure().heading({
      from: [1, 0],
      to: [0, 0],
    })
    expect(result.degrees).toBeCloseTo(270, 1)
    expect(result.reference).toBe("north-clockwise")
  })

  it("returns geodesic area with square-meter units", async () => {
    const result = await measure().area({
      positions: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    })
    expect(result.squareMeters).toBeGreaterThan(1.2e10)
    expect(result.squareMeters).toBeLessThan(1.3e10)
    expect(result.units).toBe("squareMeters")
    expect(result.mode).toBe("geodesic")
  })

  it("subtracts holes from outer ring area", async () => {
    const outer = await measure().area({
      positions: [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
    })
    const withHole = await measure().area({
      positions: [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
      holes: [
        [
          [0.5, 0.5],
          [1.5, 0.5],
          [1.5, 1.5],
          [0.5, 1.5],
        ],
      ],
    })
    expect(withHole.squareMeters).toBeLessThan(outer.squareMeters)
    expect(withHole.squareMeters).toBeGreaterThan(outer.squareMeters * 0.6)
  })
})
