import { describe, expect, it } from "vitest"
import {
  destinationLngLat,
  haversineMeters,
  lineOfSightFromSamples,
  pointInPolygon,
  pointInRect,
  slopeFromHeights,
  rayRangeMeters,
  accumulateCutFill,
  viewshedEnvelope,
} from "@arc3dlab/analysis"

describe("slopeFromHeights", () => {
  it("returns zero slope on flat terrain", () => {
    const result = slopeFromHeights(100, 100, 100, 20)
    expect(result.slopeDegrees).toBeCloseTo(0, 5)
  })

  it("faces west when height increases to the east", () => {
    const result = slopeFromHeights(100, 120, 100, 20)
    expect(result.slopeDegrees).toBeCloseTo(45, 5)
    expect(result.aspectDegrees).toBeCloseTo(270, 5)
  })

  it("faces south when height increases to the north", () => {
    const result = slopeFromHeights(100, 100, 120, 20)
    expect(result.slopeDegrees).toBeCloseTo(45, 5)
    expect(result.aspectDegrees).toBeCloseTo(180, 5)
  })
})

describe("lineOfSightFromSamples", () => {
  it("is visible when terrain stays below the line", () => {
    expect(
      lineOfSightFromSamples([
        { lineHeight: 10, terrainHeight: 0 },
        { lineHeight: 10, terrainHeight: 4 },
        { lineHeight: 10, terrainHeight: 0 },
      ]).visible
    ).toBe(true)
  })

  it("returns the first occluded interior sample", () => {
    const result = lineOfSightFromSamples([
      { lineHeight: 10, terrainHeight: 0 },
      { lineHeight: 10, terrainHeight: 40 },
      { lineHeight: 10, terrainHeight: 0 },
    ])
    expect(result.visible).toBe(false)
    expect(result.occludedIndex).toBe(1)
  })
})

describe("destinationLngLat", () => {
  it("moves east at the equator", () => {
    const dest = destinationLngLat(0, 0, 90, 111319.5)
    expect(dest.latitude).toBeCloseTo(0, 2)
    expect(dest.longitude).toBeCloseTo(1, 2)
  })
})

describe("pointInRect", () => {
  it("includes interior points", () => {
    expect(pointInRect({ longitude: 120.1, latitude: 30.1 }, { west: 120, south: 30, east: 121, north: 31 })).toBe(true)
  })
})

describe("pointInPolygon", () => {
  it("classifies a square", () => {
    const square = [
      { longitude: 0, latitude: 0 },
      { longitude: 1, latitude: 0 },
      { longitude: 1, latitude: 1 },
      { longitude: 0, latitude: 1 },
    ]
    expect(pointInPolygon({ longitude: 0.5, latitude: 0.5 }, square)).toBe(true)
    expect(pointInPolygon({ longitude: 2, latitude: 2 }, square)).toBe(false)
  })
})

describe("haversineMeters", () => {
  it("is near zero for the same point", () => {
    expect(haversineMeters({ longitude: 120, latitude: 30 }, { longitude: 120, latitude: 30 })).toBeCloseTo(0, 5)
  })
})

describe("rayRangeMeters", () => {
  it("returns the full radius when the ray is clear", () => {
    expect(rayRangeMeters(100, 5)).toBe(100)
  })

  it("scales range by the occluded sample index", () => {
    expect(rayRangeMeters(100, 5, 2)).toBe(50)
  })
})

describe("accumulateCutFill", () => {
  it("splits positive deltas into cut and negative into fill", () => {
    expect(accumulateCutFill([10, -5, 0], 2)).toEqual({ cut: 20, fill: 10 })
  })
})

describe("viewshedEnvelope", () => {
  it("places ring points along each ray heading", () => {
    const ring = viewshedEnvelope(0, 0, [
      { heading: 90, rangeMeters: 111319.5 },
      { heading: 0, rangeMeters: 111319.5 },
    ])
    expect(ring[0].longitude).toBeCloseTo(1, 2)
    expect(ring[1].latitude).toBeCloseTo(1, 2)
  })
})
