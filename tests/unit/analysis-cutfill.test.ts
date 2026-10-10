import { describe, expect, it } from "vitest"
import {
  accumulateCutFillWeighted,
  buildCutFillGrid,
  clampSampleCount,
} from "@arc3dlab/analysis"

describe("buildCutFillGrid", () => {
  it("weights interior cells at full coverage on a local-meter grid", () => {
    const grid = buildCutFillGrid(
      [
        { longitude: 0, latitude: 0 },
        { longitude: 0.01, latitude: 0 },
        { longitude: 0.01, latitude: 0.01 },
        { longitude: 0, latitude: 0.01 },
      ],
      8,
    )
    expect(grid.cells.length).toBeGreaterThan(0)
    expect(grid.resolutionMeters).toBeGreaterThan(0)
    expect(grid.cells.some((cell) => cell.coverage === 1)).toBe(true)
    expect(grid.cells.every((cell) => cell.areaSquareMeters > 0)).toBe(true)
  })
})

describe("accumulateCutFillWeighted", () => {
  it("scales cut and fill by cell area", () => {
    expect(
      accumulateCutFillWeighted([
        { delta: 2, area: 10 },
        { delta: -3, area: 4 },
      ]),
    ).toEqual({ cut: 20, fill: 12 })
  })
})

describe("clampSampleCount", () => {
  it("caps requested samples", () => {
    expect(clampSampleCount(50, 16)).toBe(16)
    expect(clampSampleCount(0)).toBe(1)
  })
})
