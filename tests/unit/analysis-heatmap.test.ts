import { afterEach, describe, expect, it, vi } from "vitest"
import type { Arc3DContext } from "../../packages/core/src/index"
import { Arc3DError } from "../../packages/core/src/errors"
import {
  computeHeatmapGrid,
  DEFAULT_HEATMAP_GRADIENT,
  gridToRgba,
  sampleGradient,
} from "../../packages/analysis/src/heatmap"
import { HeatmapOverlay } from "../../packages/analysis/src/heatmap-overlay"
import {
  DynamicHeatmapOverlay,
  interpolateHeatmapGrid,
} from "../../packages/analysis/src/dynamic-heatmap"

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

const context = {} as unknown as Arc3DContext

describe("DynamicHeatmapOverlay grid playback", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("renders frames from cached grids without recomputing points", () => {
    const setGrid = vi
      .spyOn(HeatmapOverlay.prototype, "setGrid")
      .mockImplementation(() => {})
    const setData = vi
      .spyOn(HeatmapOverlay.prototype, "setData")
      .mockImplementation(() => {})
    const overlay = new DynamicHeatmapOverlay(context)
    overlay.setFrames([{ points }, { points: points.slice(0, 1) }])

    expect(setData).not.toHaveBeenCalled()
    expect(setGrid).toHaveBeenCalledTimes(1)
    const firstCall = setGrid.mock.calls[0][0]
    const expected = computeHeatmapGrid(points)
    expect(firstCall.width).toBe(expected.width)
    expect(firstCall.values).toEqual(expected.values)

    overlay.showFrame(1)
    expect(setData).not.toHaveBeenCalled()
    expect(setGrid).toHaveBeenCalledTimes(2)
    expect(setGrid.mock.calls[1][0].extent).toEqual(
      computeHeatmapGrid(points.slice(0, 1)).extent,
    )
  })

  it("interpolates between cached grids while playing", () => {
    vi.useFakeTimers()
    const setGrid = vi
      .spyOn(HeatmapOverlay.prototype, "setGrid")
      .mockImplementation(() => {})
    const overlay = new DynamicHeatmapOverlay(context)
    const widened = points.map((point) => ({
      ...point,
      value: point.value * 2,
    }))
    overlay.setFrames([{ points }, { points: widened }])

    const gridA = computeHeatmapGrid(points)
    const gridB = computeHeatmapGrid(widened)
    overlay.play(300, 3)

    vi.advanceTimersByTime(100)
    const mid = interpolateHeatmapGrid(gridA, gridB, 100 / 300)
    expect(setGrid.mock.calls.at(-1)?.[0].values).toEqual(mid.values)

    vi.advanceTimersByTime(200)
    expect(setGrid.mock.calls.at(-1)?.[0].values).toEqual(gridB.values)

    overlay.pause()
    const count = setGrid.mock.calls.length
    vi.advanceTimersByTime(1000)
    expect(setGrid).toHaveBeenCalledTimes(count)
  })
})
