import { describe, expect, it } from "vitest"
import {
  accumulateCutFillWeighted,
  buildCutFillGrid,
  buildCutFillGridAsync,
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

  it("produces the same grid in chunked mode", async () => {
    const ring = [
      { longitude: 0, latitude: 0 },
      { longitude: 0.01, latitude: 0 },
      { longitude: 0.01, latitude: 0.01 },
      { longitude: 0, latitude: 0.01 },
    ]
    const sync = buildCutFillGrid(ring, 8)
    const chunked = await buildCutFillGridAsync(ring, 8, { chunkRows: 3 })
    expect(chunked).toEqual(sync)
  })

  it("rejects non-finite or out-of-range sample counts", () => {
    const ring = [
      { longitude: 0, latitude: 0 },
      { longitude: 0.01, latitude: 0 },
      { longitude: 0.01, latitude: 0.01 },
      { longitude: 0, latitude: 0.01 },
    ]
    for (const samples of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => buildCutFillGrid(ring, samples)).toThrowError(/samples/)
    }
  })

  it("rejects invalid sample counts in chunked mode", async () => {
    const ring = [
      { longitude: 0, latitude: 0 },
      { longitude: 0.01, latitude: 0 },
      { longitude: 0.01, latitude: 0.01 },
      { longitude: 0, latitude: 0.01 },
    ]
    await expect(
      buildCutFillGridAsync(ring, Number.NaN, { chunkRows: 1 }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
  })

  it("stops chunked grid building when cancelled between chunks", async () => {
    const controller = new AbortController()
    let chunks = 0
    await expect(
      buildCutFillGridAsync(
        [
          { longitude: 0, latitude: 0 },
          { longitude: 0.01, latitude: 0 },
          { longitude: 0.01, latitude: 0.01 },
          { longitude: 0, latitude: 0.01 },
        ],
        32,
        {
          signal: controller.signal,
          chunkRows: 1,
          yieldToEventLoop: async () => {
            chunks += 1
            controller.abort()
          },
        },
      ),
    ).rejects.toMatchObject({ code: "CANCELLED" })
    expect(chunks).toBe(1)
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

  it("rejects invalid upper bounds", () => {
    for (const maxSamples of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => clampSampleCount(10, maxSamples)).toThrowError(/maxSamples/)
    }
  })

  it("rejects non-finite requested counts", () => {
    for (const requested of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(() => clampSampleCount(requested, 10)).toThrowError(/sample count/)
    }
  })
})
