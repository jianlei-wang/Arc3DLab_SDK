import { describe, expect, it } from "vitest"
import {
  geometryMatchesDistance,
  geometryMatchesPolygon,
  geometryMatchesRect,
  headingDegrees,
  pointInPolygon,
  pointInRect,
  polygonAreaSquareMeters,
  splitRectAtAntimeridian,
} from "@arc3dlab/analysis"

const equatorSquare = [
  { longitude: 0, latitude: 0 },
  { longitude: 1, latitude: 0 },
  { longitude: 1, latitude: 1 },
  { longitude: 0, latitude: 1 },
]

describe("polygonAreaSquareMeters", () => {
  it("returns zero for collinear points", () => {
    expect(
      polygonAreaSquareMeters([
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 2, latitude: 0 },
      ])
    ).toBeCloseTo(0, 3)
  })

  it("keeps a concave L-shape smaller than its bounding rectangle", () => {
    const concave = [
      { longitude: 0, latitude: 0 },
      { longitude: 2, latitude: 0 },
      { longitude: 2, latitude: 1 },
      { longitude: 1, latitude: 1 },
      { longitude: 1, latitude: 2 },
      { longitude: 0, latitude: 2 },
    ]
    const bounds = [
      { longitude: 0, latitude: 0 },
      { longitude: 2, latitude: 0 },
      { longitude: 2, latitude: 2 },
      { longitude: 0, latitude: 2 },
    ]
    const concaveArea = polygonAreaSquareMeters(concave)
    const boundArea = polygonAreaSquareMeters(bounds)
    expect(concaveArea / boundArea).toBeCloseTo(0.75, 2)
  })

  it("matches planar mode on a small equator square within 1 percent", () => {
    const geodesic = polygonAreaSquareMeters(equatorSquare, [], "geodesic")
    const planar = polygonAreaSquareMeters(equatorSquare, [], "planar")
    expect(Math.abs(geodesic - planar) / planar).toBeLessThan(0.01)
  })

  it("unwraps rings that cross the antimeridian", () => {
    const ring = [
      { longitude: 170, latitude: 0 },
      { longitude: -170, latitude: 0 },
      { longitude: -170, latitude: 1 },
      { longitude: 170, latitude: 1 },
    ]
    const area = polygonAreaSquareMeters(ring)
    expect(area).toBeGreaterThan(1e11)
    expect(pointInPolygon({ longitude: 179, latitude: 0.5 }, ring)).toBe(true)
    expect(pointInPolygon({ longitude: 0, latitude: 0.5 }, ring)).toBe(false)
  })
})

describe("headingDegrees", () => {
  it("is 0 heading north and 90 heading east", () => {
    expect(headingDegrees({ longitude: 0, latitude: 0 }, { longitude: 0, latitude: 1 })).toBeCloseTo(0, 5)
    expect(headingDegrees({ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 0 })).toBeCloseTo(90, 5)
  })

  it("takes the short arc across the antimeridian", () => {
    expect(headingDegrees({ longitude: 179, latitude: 0 }, { longitude: -179, latitude: 0 })).toBeCloseTo(90, 1)
  })
})

describe("antimeridian rect split", () => {
  it("splits west>east rectangles into two parts", () => {
    expect(splitRectAtAntimeridian({ west: 170, south: 0, east: -170, north: 1 })).toEqual([
      { west: 170, south: 0, east: 180, north: 1 },
      { west: -180, south: 0, east: -170, north: 1 },
    ])
  })

  it("includes a point on the dateline side of a wrapping rect", () => {
    const rect = { west: 170, south: 0, east: -170, north: 1 }
    expect(pointInRect({ longitude: 179, latitude: 0.5 }, rect)).toBe(true)
    expect(pointInRect({ longitude: 0, latitude: 0.5 }, rect)).toBe(false)
  })
})

describe("geometryMatchesRect", () => {
  const rect = { west: 120, south: 30, east: 120.2, north: 30.2 }

  it("hits a polyline that crosses without vertices inside", () => {
    const line = [
      { longitude: 119.9, latitude: 30.1 },
      { longitude: 120.3, latitude: 30.1 },
    ]
    expect(geometryMatchesRect("polyline", line, rect, "intersect")).toBe(true)
    expect(geometryMatchesRect("polyline", line, rect, "within")).toBe(false)
  })

  it("hits a polygon that covers the rect without vertices inside", () => {
    const ring = [
      { longitude: 119, latitude: 29 },
      { longitude: 121, latitude: 29 },
      { longitude: 121, latitude: 31 },
      { longitude: 119, latitude: 31 },
    ]
    expect(geometryMatchesRect("polygon", ring, rect, "intersect")).toBe(true)
    expect(geometryMatchesRect("polygon", ring, rect, "within")).toBe(false)
  })
})

describe("geometryMatchesPolygon", () => {
  const query = [
    { longitude: 120, latitude: 30 },
    { longitude: 120.2, latitude: 30 },
    { longitude: 120.2, latitude: 30.2 },
    { longitude: 120, latitude: 30.2 },
  ]

  it("detects overlapping polygons that only share an interior", () => {
    const graphic = [
      { longitude: 120.1, latitude: 29.9 },
      { longitude: 120.3, latitude: 29.9 },
      { longitude: 120.3, latitude: 30.1 },
      { longitude: 120.1, latitude: 30.1 },
    ]
    expect(geometryMatchesPolygon("polygon", graphic, query, "intersect")).toBe(true)
  })
})

describe("geometryMatchesDistance", () => {
  it("uses distance to a polyline segment instead of vertices only", () => {
    const line = [
      { longitude: 119.9, latitude: 30 },
      { longitude: 120.1, latitude: 30 },
    ]
    const center = { longitude: 120, latitude: 30.0005 }
    expect(geometryMatchesDistance("polyline", line, center, 200)).toBe(true)
    expect(
      geometryMatchesDistance(
        "polyline",
        [
          { longitude: 119.9, latitude: 30 },
          { longitude: 119.91, latitude: 30 },
        ],
        center,
        200
      )
    ).toBe(false)
  })

  it("treats a point inside a polygon as distance zero", () => {
    expect(
      geometryMatchesDistance("polygon", equatorSquare, { longitude: 0.4, latitude: 0.4 }, 1)
    ).toBe(true)
  })
})
