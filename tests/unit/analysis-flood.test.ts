import { describe, expect, it } from "vitest"
import { Arc3DError } from "../../packages/core/src/errors"
import { computeFloodGrid } from "../../packages/analysis/src/flood"

describe("computeFloodGrid", () => {
  it("marks cells below the water level as flooded", () => {
    const result = computeFloodGrid({
      extent: [0, 0, 0.01, 0.01],
      width: 2,
      height: 2,
      heights: [1, 2, 3, 4],
      waterLevel: 2.5,
    })
    expect(Array.from(result.flooded)).toEqual([1, 1, 0, 0])
    expect(result.floodedRatio).toBe(0.5)
    expect(result.maxDepth).toBeCloseTo(1.5, 6)
  })

  it("reports no flooding when the water level is below all terrain", () => {
    const result = computeFloodGrid({
      extent: [0, 0, 0.01, 0.01],
      width: 2,
      height: 2,
      heights: [10, 20, 30, 40],
      waterLevel: 5,
    })
    expect(result.floodedRatio).toBe(0)
    expect(result.maxDepth).toBe(0)
  })

  it("rejects invalid dimensions and mismatched heights", () => {
    expect(() =>
      computeFloodGrid({
        extent: [0, 0, 0.01, 0.01],
        width: 0,
        height: 2,
        heights: [],
        waterLevel: 1,
      }),
    ).toThrow(Arc3DError)
    expect(() =>
      computeFloodGrid({
        extent: [0, 0, 0.01, 0.01],
        width: 2,
        height: 2,
        heights: [1, 2, 3],
        waterLevel: 1,
      }),
    ).toThrow(Arc3DError)
  })
})
