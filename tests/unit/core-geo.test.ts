import { describe, expect, it } from "vitest"
import {
  WGS84_SEMI_MAJOR_AXIS,
  angleBetweenHeadings,
  degreesToRadians,
  extentOf,
  greatCircleDistanceMeters,
  interpolateLngLat,
  interpolatePolyline,
  normalizeHeading,
  pointByHeadingDistance,
  polygonCentroid,
  radiansToDegrees,
} from "../../packages/core/src/geo"
import { Arc3DError } from "../../packages/core/src/errors"

describe("angle helpers", () => {
  it("round-trips degrees and radians", () => {
    expect(radiansToDegrees(degreesToRadians(123))).toBeCloseTo(123, 10)
    expect(WGS84_SEMI_MAJOR_AXIS).toBe(6378137)
  })

  it("normalizes headings into [0, 360)", () => {
    expect(normalizeHeading(-90)).toBeCloseTo(270, 10)
    expect(normalizeHeading(720)).toBeCloseTo(0, 10)
    expect(normalizeHeading(45)).toBeCloseTo(45, 10)
  })

  it("reports the smallest angle between headings", () => {
    expect(angleBetweenHeadings(350, 10)).toBeCloseTo(20, 10)
    expect(angleBetweenHeadings(90, 270)).toBeCloseTo(180, 10)
    expect(angleBetweenHeadings(0, 180)).toBeCloseTo(180, 10)
  })
})

describe("pointByHeadingDistance", () => {
  it("moves east from the equator", () => {
    const dest = pointByHeadingDistance(
      { longitude: 0, latitude: 0 },
      90,
      WGS84_SEMI_MAJOR_AXIS * (Math.PI / 180),
    )
    expect(dest.latitude).toBeCloseTo(0, 4)
    expect(dest.longitude).toBeCloseTo(1, 4)
  })

  it("rejects non-finite inputs", () => {
    expect(() =>
      pointByHeadingDistance({ longitude: 0, latitude: 0 }, NaN, 1),
    ).toThrow(Arc3DError)
  })
})

describe("greatCircleDistanceMeters", () => {
  it("is zero for the same point", () => {
    expect(
      greatCircleDistanceMeters(
        { longitude: 120, latitude: 30 },
        { longitude: 120, latitude: 30 },
      ),
    ).toBeCloseTo(0, 6)
  })

  it("increases with separation", () => {
    const near = greatCircleDistanceMeters(
      { longitude: 0, latitude: 0 },
      { longitude: 0.01, latitude: 0 },
    )
    const far = greatCircleDistanceMeters(
      { longitude: 0, latitude: 0 },
      { longitude: 0.1, latitude: 0 },
    )
    expect(far).toBeGreaterThan(near)
  })
})

describe("interpolatePolyline", () => {
  it("keeps endpoints and adds intermediate points", () => {
    const points = interpolatePolyline(
      [
        { longitude: 0, latitude: 0 },
        { longitude: 0.1, latitude: 0 },
      ],
      1000,
    )
    expect(points[0]).toEqual({ longitude: 0, latitude: 0 })
    expect(points.length).toBeGreaterThan(2)
    const last = points[points.length - 1]
    expect(last.longitude).toBeCloseTo(0.1, 8)
    expect(last.latitude).toBeCloseTo(0, 8)
  })

  it("returns a single point unchanged", () => {
    const points = interpolatePolyline([{ longitude: 1, latitude: 2 }], 100)
    expect(points).toEqual([{ longitude: 1, latitude: 2 }])
  })

  it("rejects empty input and non-positive step", () => {
    expect(() => interpolatePolyline([], 10)).toThrow(Arc3DError)
    expect(() =>
      interpolatePolyline([{ longitude: 0, latitude: 0 }], 0),
    ).toThrow(Arc3DError)
  })

  it("interpolates a fraction between points", () => {
    const mid = interpolateLngLat(
      { longitude: 0, latitude: 0 },
      { longitude: 2, latitude: 4 },
      0.5,
    )
    expect(mid).toEqual({ longitude: 1, latitude: 2 })
  })
})

describe("polygonCentroid", () => {
  it("computes the centre of a square", () => {
    const centroid = polygonCentroid([
      { longitude: 0, latitude: 0 },
      { longitude: 1, latitude: 0 },
      { longitude: 1, latitude: 1 },
      { longitude: 0, latitude: 1 },
    ])
    expect(centroid.longitude).toBeCloseTo(0.5, 8)
    expect(centroid.latitude).toBeCloseTo(0.5, 8)
  })

  it("rejects rings with fewer than three points", () => {
    expect(() =>
      polygonCentroid([
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ]),
    ).toThrow(Arc3DError)
  })
})

describe("extentOf", () => {
  it("computes the bounding extent", () => {
    expect(
      extentOf([
        { longitude: 2, latitude: 1 },
        { longitude: -1, latitude: 5 },
        { longitude: 3, latitude: -2 },
      ]),
    ).toEqual([-1, -2, 3, 5])
  })

  it("rejects empty input", () => {
    expect(() => extentOf([])).toThrow(Arc3DError)
  })
})
