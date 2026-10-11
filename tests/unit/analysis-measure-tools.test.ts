import { describe, expect, it } from "vitest"
import {
  projectToEllipsoid,
  projectedDistanceMeters,
  slopeAngleDegrees,
  surfaceDistanceMeters,
  triangleAreaSquareMeters,
} from "../../packages/analysis/src/measure-tools"
import { geodesicDistanceMeters } from "../../packages/analysis/src/geometry"

const a = { longitude: 116.39, latitude: 39.9 }
const b = { longitude: 116.41, latitude: 39.9 }
const c = { longitude: 116.4, latitude: 39.92 }

describe("measure-tools", () => {
  it("projects a coordinate onto the ellipsoid", () => {
    expect(projectToEllipsoid({ ...a, height: 120 } as never)).toEqual(a)
  })

  it("ignores height when computing projected distance", () => {
    const flat = projectedDistanceMeters(a, b)
    const lifted = projectedDistanceMeters(
      { ...a, height: 500 },
      { ...b, height: 900 },
    )
    expect(lifted).toBeCloseTo(flat, 6)
    expect(flat).toBeCloseTo(geodesicDistanceMeters(a, b), 6)
  })

  it("accumulates surface distance along a polyline", () => {
    const total = surfaceDistanceMeters([a, b, c])
    const manual = geodesicDistanceMeters(a, b) + geodesicDistanceMeters(b, c)
    expect(total).toBeCloseTo(manual, 6)
  })

  it("computes a positive slope angle for a rising line", () => {
    const degrees = slopeAngleDegrees(
      { ...a, height: 0 },
      { ...b, height: 1000 },
    )
    expect(degrees).toBeGreaterThan(25)
    expect(degrees).toBeLessThan(35)
  })

  it("returns a negative slope angle for a descending line", () => {
    const degrees = slopeAngleDegrees(
      { ...a, height: 100 },
      { ...b, height: 0 },
    )
    expect(degrees).toBeLessThan(0)
  })

  it("computes a positive triangle area", () => {
    expect(triangleAreaSquareMeters(a, b, c)).toBeGreaterThan(0)
  })
})
