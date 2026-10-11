import { describe, expect, it } from "vitest"
import { Arc3DError } from "../../packages/core/src/errors"
import {
  bufferPoint,
  bufferPolygon,
  bufferPolyline,
} from "../../packages/analysis/src/buffer"
import {
  geodesicDistanceMeters,
  geodesicRingArea,
} from "../../packages/analysis/src/geometry"

const center = { longitude: 116.397, latitude: 39.909 }

describe("bufferPoint", () => {
  it("builds a closed ring around the centre", () => {
    const ring = bufferPoint(center, 1000, 64)
    expect(ring.length).toBe(65)
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it("keeps every vertex at the requested distance", () => {
    const ring = bufferPoint(center, 1000, 64)
    for (const point of ring.slice(0, -1)) {
      expect(geodesicDistanceMeters(center, point)).toBeGreaterThan(900)
      expect(geodesicDistanceMeters(center, point)).toBeLessThan(1100)
    }
  })

  it("rejects non-positive radius", () => {
    expect(() => bufferPoint(center, 0)).toThrow(Arc3DError)
    expect(() => bufferPoint(center, -10)).toThrow(Arc3DError)
  })
})

describe("bufferPolyline", () => {
  const line = [
    { longitude: 116.39, latitude: 39.9 },
    { longitude: 116.4, latitude: 39.91 },
    { longitude: 116.41, latitude: 39.9 },
  ]

  it("returns a closed ring wider than the line", () => {
    const ring = bufferPolyline(line, 500)
    expect(ring.length).toBeGreaterThan(4)
    expect(ring[0]).toEqual(ring[ring.length - 1])
    expect(geodesicRingArea(ring)).toBeGreaterThan(0)
  })

  it("rejects too few positions and non-positive distance", () => {
    expect(() => bufferPolyline([line[0]], 100)).toThrow(Arc3DError)
    expect(() => bufferPolyline(line, 0)).toThrow(Arc3DError)
  })
})

describe("bufferPolygon", () => {
  const square = [
    { longitude: 0, latitude: 0 },
    { longitude: 0.01, latitude: 0 },
    { longitude: 0.01, latitude: 0.01 },
    { longitude: 0, latitude: 0.01 },
  ]

  it("expands outward for a positive distance", () => {
    const base = geodesicRingArea(square)
    const buffered = geodesicRingArea(bufferPolygon(square, 500))
    expect(buffered).toBeGreaterThan(base)
  })

  it("shrinks inward for a negative distance", () => {
    const base = geodesicRingArea(square)
    const buffered = geodesicRingArea(bufferPolygon(square, -200))
    expect(buffered).toBeLessThan(base)
    expect(buffered).toBeGreaterThan(0)
  })

  it("rejects zero distance and too few positions", () => {
    expect(() => bufferPolygon(square, 0)).toThrow(Arc3DError)
    expect(() => bufferPolygon([square[0], square[1]], 100)).toThrow(Arc3DError)
  })
})
