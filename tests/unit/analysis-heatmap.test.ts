import { describe, expect, it } from "vitest"
import { Arc3DError } from "../../packages/core/src/errors"
import {
  computeHeatmapGrid,
  DEFAULT_HEATMAP_GRADIENT,
  gridToRgba,
  sampleGradient,
} from "../../packages/analysis/src/heatmap"
import { interpolateHeatmapGrid } from "../../packages/analysis/src/dynamic-heatmap"

const points = [
  { longitude: 116.39, latitude: 39.9, value: 1 },
  { longitude: 116.4, latitude: 39.91, value: 2 },
  { longitude: 116.41, latitude: 39.9, value: 1 },
]

describe("heatmap", () => {
  it("builds a normalised grid covering the points", () => {
    const grid = computeHeatmapGrid(points, { radius: 800 })
    expect(grid.width).toBeGreaterThan(0)
    expect(grid.height).toBeGreaterThan(0)
    expect(grid.values.length).toBe(grid.width * grid.height)
    expect(Array.from(grid.values).some((value) => value > 0.9)).toBe(true)
    expect(Math.max(...Array.from(grid.values))).toBeCloseTo(1, 5)
    expect(grid.extent[0]).toBeLessThan(116.39)
    expect(grid.extent[2]).toBeGreaterThan(116.41)
  })

  it("rejects empty points and non-positive radius", () => {
    expect(() => computeHeatmapGrid([])).toThrow(Arc3DError)
    expect(() => computeHeatmapGrid(points, { radius: 0 })).toThrow(Arc3DError)
  })

  it("samples the gradient endpoints", () => {
    expect(sampleGradient(DEFAULT_HEATMAP_GRADIENT, 0)).toEqual(
      DEFAULT_HEATMAP_GRADIENT[0].color,
    )
    const last = DEFAULT_HEATMAP_GRADIENT[DEFAULT_HEATMAP_GRADIENT.length - 1]
    expect(sampleGradient(DEFAULT_HEATMAP_GRADIENT, 1)).toEqual(last.color)
    expect(sampleGradient([], 0.5)).toEqual([0, 0, 0, 0])
  })

  it("converts a grid to rgba pixels", () => {
    const grid = computeHeatmapGrid(points, { radius: 800 })
    const rgba = gridToRgba(grid)
    expect(rgba.length).toBe(grid.width * grid.height * 4)
  })

  it("interpolates two grids of the same size", () => {
    const first = computeHeatmapGrid(points, { radius: 800 })
    const second = computeHeatmapGrid(
      points.map((point) => ({ ...point, value: point.value * 2 })),
      { radius: 800 },
    )
    const mid = interpolateHeatmapGrid(first, second, 0.5)
    expect(mid.width).toBe(first.width)
    for (let i = 0; i < mid.values.length; i += 1) {
      expect(mid.values[i]).toBeCloseTo(
        (first.values[i] + second.values[i]) / 2,
        5,
      )
    }
  })

  it("returns the source grid when sizes differ", () => {
    const first = computeHeatmapGrid(points, { radius: 800 })
    const second = computeHeatmapGrid(points, { radius: 400 })
    expect(
      interpolateHeatmapGrid(
        first,
        { ...second, width: second.width + 1 },
        0.5,
      ),
    ).toBe(first)
  })
})
