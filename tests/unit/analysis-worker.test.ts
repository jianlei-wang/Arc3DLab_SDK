import { describe, expect, it } from "vitest"
import { Arc3DError } from "@arc3dlab/core"
import {
  AnalysisWorkerHost,
  executeAnalysisJob,
  restoreAnalysisError,
  serializeAnalysisError,
} from "@arc3dlab/analysis"

describe("executeAnalysisJob", () => {
  it("runs a rectangle query without a Cesium scene", () => {
    const result = executeAnalysisJob({
      type: "rect-query",
      graphics: [
        {
          id: "in",
          type: "point",
          positions: [{ longitude: 104.05, latitude: 30.55, height: 0 }],
        },
        {
          id: "out",
          type: "point",
          positions: [{ longitude: 105, latitude: 31, height: 0 }],
        },
      ],
      rect: { west: 104, south: 30.5, east: 104.2, north: 30.7 },
    })
    expect(result).toEqual({
      type: "query",
      graphics: [{ id: "in", type: "point" }],
    })
  })
})

describe("AnalysisWorkerHost", () => {
  it("resolves a pure math job", async () => {
    const host = new AnalysisWorkerHost()
    const result = await host.run({
      type: "area",
      positions: [
        [104, 30.5],
        [104.2, 30.5],
        [104.2, 30.7],
        [104, 30.7],
      ],
    })
    expect(result.type).toBe("area")
    if (result.type === "area") {
      expect(result.squareMeters).toBeGreaterThan(0)
    }
    host.destroy()
  })

  it("cancels a pending job through AbortSignal", async () => {
    const host = new AnalysisWorkerHost()
    const controller = new AbortController()
    const pending = host.run(
      {
        type: "area",
        positions: [
          [104, 30.5],
          [104.2, 30.5],
          [104.2, 30.7],
        ],
      },
      { signal: controller.signal },
    )
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" })
    host.destroy()
  })

  it("cancels in-flight jobs when destroyed", async () => {
    const host = new AnalysisWorkerHost()
    const pending = host.run({
      type: "cutfill-grid",
      polygon: [
        [104, 30.5],
        [104.2, 30.5],
        [104.2, 30.7],
        [104, 30.7],
      ],
      samples: 8,
    })
    host.destroy()
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" })
    await expect(
      host.run({
        type: "area",
        positions: [
          [104, 30.5],
          [104.2, 30.5],
          [104.2, 30.7],
        ],
      }),
    ).rejects.toMatchObject({ code: "CANCELLED" })
  })

  it("serializes worker errors back into Arc3DError", () => {
    const payload = serializeAnalysisError(
      new Arc3DError("INVALID_ARGUMENT", "bad job"),
    )
    expect(payload).toEqual({
      code: "INVALID_ARGUMENT",
      message: "bad job",
    })
    const restored = restoreAnalysisError(payload)
    expect(restored).toBeInstanceOf(Arc3DError)
    expect(restored.code).toBe("INVALID_ARGUMENT")
  })
})
