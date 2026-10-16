import { describe, expect, it } from "vitest"
import { Arc3DError } from "@arc3dlab/core"
import {
  AnalysisJobHost,
  executeAnalysisJob,
  restoreAnalysisError,
  serializeAnalysisError,
  type AnalysisJob,
  type AnalysisWorkerLike,
} from "@arc3dlab/analysis"

type WorkerReply =
  | { result: ReturnType<typeof executeAnalysisJob> }
  | { error: { code: string; message: string } }

class FakeWorker implements AnalysisWorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  terminated = false
  readonly requests: Array<{ id: number; job: AnalysisJob }> = []

  constructor(
    private readonly respond = (job: AnalysisJob): WorkerReply => ({
      result: executeAnalysisJob(job),
    }),
    private readonly autoRespond = true,
  ) {}

  postMessage(message: unknown): void {
    const request = message as { id: number; job: AnalysisJob }
    this.requests.push(request)
    if (!this.autoRespond) return
    queueMicrotask(() => {
      if (this.terminated) return
      this.onmessage?.({
        data: { id: request.id, ...this.respond(request.job) },
      })
    })
  }

  terminate(): void {
    this.terminated = true
  }
}

const square: AnalysisJob = {
  type: "area",
  positions: [
    [104, 30.5],
    [104.2, 30.5],
    [104.2, 30.7],
    [104, 30.7],
  ],
}

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

describe("AnalysisJobHost", () => {
  it("resolves a pure math job", async () => {
    const host = new AnalysisJobHost()
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
    const host = new AnalysisJobHost()
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
    const host = new AnalysisJobHost()
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

describe("AnalysisJobHost worker transport", () => {
  it("delegates jobs to an injected worker", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker()
        workers.push(worker)
        return worker
      },
    })
    const result = await host.run(square)
    expect(result).toEqual({ type: "area", squareMeters: expect.any(Number) })
    expect(workers).toHaveLength(1)
    expect(workers[0].requests).toHaveLength(1)
    host.destroy()
  })

  it("restores worker failures and preserves the error code", async () => {
    const host = new AnalysisJobHost({
      createWorker: () =>
        new FakeWorker(() => ({
          error: { code: "INVALID_ARGUMENT", message: "boom" },
        })),
    })
    await expect(host.run(square)).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
      message: "boom",
    })
    host.destroy()
  })

  it("rejects non-cloneable jobs before dispatching to a worker", async () => {
    let created = 0
    const host = new AnalysisJobHost({
      createWorker: () => {
        created += 1
        return new FakeWorker()
      },
    })
    const job = {
      ...square,
      payload: () => 1,
    } as unknown as AnalysisJob
    await expect(host.run(job)).rejects.toMatchObject({
      code: "INVALID_FORMAT",
    })
    expect(created).toBe(0)
    host.destroy()
  })

  it("terminates the worker when a job is cancelled", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const controller = new AbortController()
    const pending = host.run(square, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" })
    expect(workers).toHaveLength(1)
    expect(workers[0].terminated).toBe(true)
    host.destroy()
  })

  it("creates a fresh worker for the next job after cancellation", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker()
        workers.push(worker)
        return worker
      },
    })
    const controller = new AbortController()
    const pending = host.run(square, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" })
    const result = await host.run(square)
    expect(result.type).toBe("area")
    expect(workers).toHaveLength(2)
    expect(workers[1].terminated).toBe(false)
    host.destroy()
  })

  it("terminates the worker on destroy and rejects later jobs", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const pending = host.run(square)
    pending.catch(() => undefined)
    host.destroy()
    expect(workers[0].terminated).toBe(true)
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" })
    await expect(host.run(square)).rejects.toMatchObject({
      code: "CANCELLED",
    })
  })
})
