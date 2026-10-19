import { describe, expect, it } from "vitest"
import { AnalysisJobHost, buildCutFillGrid } from "@arc3dlab/analysis"

const ring = [
  { longitude: 120, latitude: 30 },
  { longitude: 120.2, latitude: 30 },
  { longitude: 120.2, latitude: 30.2 },
  { longitude: 120, latitude: 30.2 },
]

const GENEROUS_BUDGET_MS = 5000
const SIZES = [
  { name: "small", samples: 8 },
  { name: "medium", samples: 64 },
  { name: "large", samples: 192 },
]

describe("analysis performance baseline", () => {
  it("keeps cut fill grid work within a generous budget across sizes", () => {
    const heapBefore = process.memoryUsage().heapUsed
    for (const size of SIZES) {
      const started = performance.now()
      const grid = buildCutFillGrid(ring, size.samples)
      const duration = performance.now() - started
      expect(grid.cells).toHaveLength(size.samples * size.samples)
      expect(duration).toBeLessThan(GENEROUS_BUDGET_MS)
      expect(Number.isFinite(grid.resolutionMeters)).toBe(true)
    }
    const heapGrowth = process.memoryUsage().heapUsed - heapBefore
    expect(heapGrowth).toBeLessThan(256 * 1024 * 1024)
  })

  it("keeps direct and in-process fallback execution comparable", async () => {
    const host = new AnalysisJobHost({
      createWorker: () => {
        throw new Error("worker unavailable in this environment")
      },
    })
    try {
      const directStarted = performance.now()
      const direct = await host.run({
        type: "cutfill-grid",
        polygon: ring,
        samples: 64,
      })
      const directMs = performance.now() - directStarted
      expect(direct).toMatchObject({ type: "cutfill-grid" })
      expect(directMs).toBeLessThan(GENEROUS_BUDGET_MS)

      const fallbackStarted = performance.now()
      const fallback = await host.run({
        type: "area",
        positions: ring,
      })
      const fallbackMs = performance.now() - fallbackStarted
      expect(fallback).toMatchObject({ type: "area" })
      expect(fallbackMs).toBeLessThan(GENEROUS_BUDGET_MS)
      expect(host.getDiagnostics().workerUnavailable).toBe(true)
    } finally {
      host.destroy()
    }
  })
})
