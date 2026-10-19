import { afterEach, describe, expect, it, vi } from "vitest"
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
  onmessageerror: ((event: unknown) => void) | null = null
  terminated = false
  terminateCalls = 0
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
    this.terminateCalls += 1
  }
}

class ThrowingWorker extends FakeWorker {
  override postMessage(): void {
    throw new Error("DataCloneError: job could not be cloned")
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it("rejects invalid numeric query inputs", () => {
    for (const rect of [
      { west: Number.NaN, south: 30, east: 104, north: 31 },
      { west: 104, south: 31, east: 105, north: 30 },
    ]) {
      expect(() =>
        executeAnalysisJob({
          type: "rect-query",
          graphics: [],
          rect,
        }),
      ).toThrowError(expect.objectContaining({ code: "INVALID_ARGUMENT" }))
    }
    expect(() =>
      executeAnalysisJob({
        type: "distance-query",
        graphics: [],
        position: [104, 30],
        meters: Number.NaN,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ARGUMENT" }))
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

  it("snapshots jobs queued behind busy workers", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    for (let i = 0; i < 4; i += 1) {
      host.run(square).catch(() => undefined)
    }
    expect(workers).toHaveLength(4)

    const positions: Array<[number, number]> = [
      [104, 30.5],
      [104.2, 30.5],
      [104.2, 30.7],
      [104, 30.7],
    ]
    const expected = executeAnalysisJob({
      type: "area",
      positions: positions.map((position) => [...position]),
    })
    const pending = host.run({ type: "area", positions })

    positions[0] = [0, 0]
    positions[1] = [0, 0]

    const first = workers[0].requests[0]
    workers[0].onmessage?.({
      data: { id: first.id, result: executeAnalysisJob(first.job) },
    })

    const queued = workers[0].requests[1]
    expect(queued.job).toMatchObject({
      type: "area",
      positions: [
        [104, 30.5],
        [104.2, 30.5],
        [104.2, 30.7],
        [104, 30.7],
      ],
    })
    workers[0].onmessage?.({
      data: { id: queued.id, result: executeAnalysisJob(queued.job) },
    })
    await expect(pending).resolves.toEqual(expected)
    host.destroy()
  })

  it("rejects invalid cutfill sample counts in the fallback path", async () => {
    const host = new AnalysisJobHost({
      createWorker: () => {
        throw new Error("worker unavailable")
      },
    })
    await expect(
      host.run({
        type: "cutfill-grid",
        polygon: [
          [104, 30.5],
          [104.2, 30.5],
          [104.2, 30.7],
          [104, 30.7],
        ],
        samples: Number.NaN,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
    host.destroy()
  })

  it("replays the job snapshot when falling back in-process", async () => {
    const host = new AnalysisJobHost({
      createWorker: () => {
        throw new Error("worker unavailable")
      },
    })
    const positions: Array<[number, number]> = [
      [104, 30.5],
      [104.2, 30.5],
      [104.2, 30.7],
      [104, 30.7],
    ]
    const expected = executeAnalysisJob({
      type: "area",
      positions: positions.map((position) => [...position]),
    })
    const pending = host.run({ type: "area", positions })
    positions[0] = [0, 0]
    positions[1] = [0, 0]
    await expect(pending).resolves.toEqual(expected)
    host.destroy()
  })

  it("falls back in-process when a worker script fails asynchronously", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const pending = host.run(square)
    workers[0].onerror?.({ message: "Failed to load worker script" })
    await expect(pending).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })

    await expect(host.run(square)).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    expect(workers).toHaveLength(1)
    host.destroy()
  })

  it("falls back queued jobs when a worker is blocked by CSP", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    for (let i = 0; i < 4; i += 1) {
      host.run(square).catch(() => undefined)
    }
    const queued = host.run(square)
    workers[0].onerror?.({
      message:
        "Refused to load the worker script because it violates the Content Security Policy",
    })
    await expect(queued).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    expect(workers).toHaveLength(4)
    host.destroy()
  })

  it("bounds in-process fallback concurrency and drains the fallback queue", async () => {
    const gates: Array<() => void> = []
    let started = 0
    const host = new AnalysisJobHost({
      maxWorkers: 1,
      maxQueue: 2,
      createWorker: () => {
        throw new Error("worker unavailable")
      },
      executeCooperative: (job) =>
        new Promise((resolve) => {
          started += 1
          gates.push(() => resolve(executeAnalysisJob(job)))
        }),
    })
    const jobs = [host.run(square), host.run(square), host.run(square)]
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(started).toBe(1)
    expect(host.getDiagnostics()).toMatchObject({
      workerUnavailable: true,
      inProcessJobs: 1,
      queuedJobs: 2,
      pendingJobs: 3,
    })

    gates[0]()
    await jobs[0]
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(started).toBe(2)

    gates[1]()
    await jobs[1]
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(started).toBe(3)

    gates[2]()
    await jobs[2]
    expect(host.getDiagnostics()).toMatchObject({
      inProcessJobs: 0,
      queuedJobs: 0,
      pendingJobs: 0,
      completedJobs: 3,
    })
    host.destroy()
  })

  it("reports bounded execution durations in diagnostics", async () => {
    const host = new AnalysisJobHost({
      createWorker: () => {
        throw new Error("worker unavailable")
      },
      executeCooperative: async (job) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        return executeAnalysisJob(job)
      },
    })
    await host.run(square)
    await host.run(square)
    const diagnostics = host.getDiagnostics()
    expect(diagnostics.timedJobs).toBe(2)
    expect(diagnostics.totalExecutionMs).toBeGreaterThanOrEqual(10)
    expect(diagnostics.averageExecutionMs).toBeCloseTo(
      diagnostics.totalExecutionMs / 2,
    )
    expect(diagnostics.maxExecutionMs).toBeGreaterThanOrEqual(5)
    expect(diagnostics.lastExecutionMs).toBeGreaterThanOrEqual(5)
    host.destroy()
  })

  it("isolates worker pools and queues across multiple hosts", async () => {
    const stalled: FakeWorker[] = []
    const hostA = new AnalysisJobHost({
      maxWorkers: 1,
      maxQueue: 0,
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        stalled.push(worker)
        return worker
      },
    })
    const hostB = new AnalysisJobHost({
      maxWorkers: 1,
      createWorker: () => new FakeWorker(),
    })
    const running = hostA.run(square).catch(() => undefined)
    await expect(hostA.run(square)).rejects.toMatchObject({
      code: "QUEUE_FULL",
    })
    await expect(hostB.run(square)).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    expect(stalled).toHaveLength(1)
    expect(hostA.getDiagnostics()).toMatchObject({
      activeWorkers: 1,
      runningJobs: 1,
      queuedJobs: 0,
      rejectedJobs: 1,
      pendingJobs: 1,
    })
    expect(hostB.getDiagnostics()).toMatchObject({
      activeWorkers: 1,
      runningJobs: 0,
      queuedJobs: 0,
      completedJobs: 1,
    })
    hostA.destroy()
    hostB.destroy()
    await running
  })

  it("caps default concurrency at four and queues excess jobs", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const jobs = Array.from({ length: 6 }, () =>
      host.run(square).catch((error: unknown) => error),
    )
    expect(workers).toHaveLength(4)
    expect(host.getDiagnostics()).toMatchObject({
      maxWorkers: 4,
      activeWorkers: 4,
      runningJobs: 4,
      queuedJobs: 2,
      pendingJobs: 6,
      startedJobs: 4,
    })
    host.destroy()
    await Promise.all(jobs)
    expect(host.getDiagnostics()).toMatchObject({
      activeWorkers: 0,
      queuedJobs: 0,
      pendingJobs: 0,
      cancelledJobs: 6,
    })
  })

  it("cancels a queued job without disturbing the running job", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      maxWorkers: 1,
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const running = host.run(square)
    const controller = new AbortController()
    const queued = host.run(square, { signal: controller.signal })
    expect(host.getDiagnostics()).toMatchObject({
      runningJobs: 1,
      queuedJobs: 1,
      pendingJobs: 2,
    })
    controller.abort()
    await expect(queued).rejects.toMatchObject({ code: "CANCELLED" })
    expect(workers[0].requests).toHaveLength(1)
    expect(host.getDiagnostics()).toMatchObject({
      runningJobs: 1,
      queuedJobs: 0,
      cancelledJobs: 1,
      pendingJobs: 1,
    })

    const request = workers[0].requests[0]
    workers[0].onmessage?.({
      data: { id: request.id, result: executeAnalysisJob(request.job) },
    })
    await expect(running).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    host.destroy()
  })

  it("falls back once and caches the worker as unavailable on startup failure", async () => {
    let attempts = 0
    const host = new AnalysisJobHost({
      createWorker: () => {
        attempts += 1
        throw new Error("worker startup failed")
      },
    })
    const first = host.run(square)
    expect(host.getDiagnostics()).toMatchObject({
      activeWorkers: 0,
      workerUnavailable: true,
    })
    await expect(first).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    await expect(host.run(square)).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    expect(attempts).toBe(1)
    expect(host.getDiagnostics()).toMatchObject({
      workerUnavailable: true,
      startedJobs: 2,
      completedJobs: 2,
    })
    host.destroy()
  })

  it("replays an in-flight job when the worker crashes at runtime", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const pending = host.run(square)
    workers[0].onerror?.({ message: "worker crashed" })
    await expect(pending).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    expect(workers[0].terminated).toBe(true)
    expect(host.getDiagnostics()).toMatchObject({
      workerUnavailable: true,
      activeWorkers: 0,
      completedJobs: 1,
    })
    host.destroy()
  })

  it("rejects in-flight and queued jobs once when destroyed", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      maxWorkers: 1,
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const running = host.run(square)
    const queued = host.run(square)
    host.destroy()
    host.destroy()
    await expect(running).rejects.toMatchObject({ code: "CANCELLED" })
    await expect(queued).rejects.toMatchObject({ code: "CANCELLED" })
    expect(workers[0].terminated).toBe(true)
    expect(host.getDiagnostics()).toMatchObject({
      terminated: true,
      activeWorkers: 0,
      queuedJobs: 0,
      pendingJobs: 0,
      cancelledJobs: 2,
    })
  })

  it("cancels an in-process job while destroy is racing its completion", async () => {
    let release: (() => void) | undefined
    const host = new AnalysisJobHost({
      createWorker: () => {
        throw new Error("worker unavailable")
      },
      executeCooperative: (job) =>
        new Promise((resolve) => {
          release = () => resolve(executeAnalysisJob(job))
        }),
    })
    const pending = host.run(square)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(release).toBeTypeOf("function")
    expect(host.getDiagnostics()).toMatchObject({ inProcessJobs: 1 })
    host.destroy()
    release?.()
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.getDiagnostics()).toMatchObject({
      terminated: true,
      inProcessJobs: 0,
      pendingJobs: 0,
      cancelledJobs: 1,
    })
  })

  it("returns business errors from worker messages without retrying", async () => {
    let created = 0
    let fallbacks = 0
    const host = new AnalysisJobHost({
      execute: () => {
        fallbacks += 1
        return executeAnalysisJob(square)
      },
      createWorker: () => {
        created += 1
        return new FakeWorker(() => ({
          error: { code: "INVALID_ARGUMENT", message: "boom" },
        }))
      },
    })
    await expect(host.run(square)).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    })
    await expect(host.run(square)).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    })
    expect(fallbacks).toBe(0)
    expect(created).toBe(1)
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

  it("rejects malformed worker responses with INVALID_FORMAT", async () => {
    const malformed: Array<Record<string, unknown>> = [
      {},
      { result: null },
      { result: { type: "distance", meters: 10 } },
      { result: { type: "area", squareMeters: Number.NaN } },
      { result: { type: "cutfill-grid", grid: null } },
      { error: { code: "INVALID_ARGUMENT" } },
      { error: { code: "NOT_A_REAL_CODE", message: "boom" } },
      {
        result: { type: "area", squareMeters: 1 },
        error: { code: "INVALID_ARGUMENT", message: "boom" },
      },
    ]
    for (const payload of malformed) {
      const workers: FakeWorker[] = []
      const host = new AnalysisJobHost({
        createWorker: () => {
          const worker = new FakeWorker(undefined, false)
          workers.push(worker)
          return worker
        },
      })
      const pending = host.run(square)
      const request = workers[0].requests[0]
      workers[0].onmessage?.({ data: { id: request.id, ...payload } })
      await expect(pending).rejects.toMatchObject({ code: "INVALID_FORMAT" })
      expect(workers[0].terminated).toBe(true)
      expect(host.getDiagnostics()).toMatchObject({
        protocolErrors: 1,
        activeWorkers: 0,
        queuedJobs: 0,
        pendingJobs: 0,
        completedJobs: 0,
        failedJobs: 1,
        cancelledJobs: 0,
      })
      host.destroy()
    }
  })

  it("ignores malformed messages that cannot be attributed to a task", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const pending = host.run(square)
    const request = workers[0].requests[0]
    workers[0].onmessage?.({ data: "garbage" })
    workers[0].onmessage?.({ data: { id: "not-a-number" } })
    workers[0].onmessage?.({
      data: { id: request.id + 100, result: { type: "area", squareMeters: 1 } },
    })
    expect(host.getDiagnostics()).toMatchObject({
      protocolErrors: 2,
      pendingJobs: 1,
      completedJobs: 0,
    })

    workers[0].onmessage?.({
      data: { id: request.id, result: executeAnalysisJob(square) },
    })
    await expect(pending).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    expect(host.getDiagnostics()).toMatchObject({
      protocolErrors: 2,
      pendingJobs: 0,
      completedJobs: 1,
    })
    host.destroy()
  })

  it("ignores responses routed to the wrong worker slot", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      maxWorkers: 2,
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const first = host.run(square)
    const second = host.run(square)
    const firstRequest = workers[0].requests[0]
    const secondRequest = workers[1].requests[0]
    workers[0].onmessage?.({
      data: {
        id: secondRequest.id,
        result: executeAnalysisJob(secondRequest.job),
      },
    })
    expect(host.getDiagnostics()).toMatchObject({
      pendingJobs: 2,
      completedJobs: 0,
    })

    workers[0].onmessage?.({
      data: { id: firstRequest.id, result: executeAnalysisJob(square) },
    })
    workers[1].onmessage?.({
      data: { id: secondRequest.id, result: executeAnalysisJob(square) },
    })
    await expect(first).resolves.toMatchObject({ type: "area" })
    await expect(second).resolves.toMatchObject({ type: "area" })
    expect(host.getDiagnostics()).toMatchObject({
      pendingJobs: 0,
      completedJobs: 2,
      protocolErrors: 0,
    })
    host.destroy()
  })

  it("settles a job with ENGINE_FAILURE when postMessage throws synchronously", async () => {
    let attempts = 0
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      maxWorkers: 1,
      maxQueue: 0,
      createWorker: () => {
        attempts += 1
        const worker = attempts === 1 ? new ThrowingWorker() : new FakeWorker()
        workers.push(worker)
        return worker
      },
    })
    await expect(host.run(square)).rejects.toMatchObject({
      code: "ENGINE_FAILURE",
      message: expect.stringContaining("Failed to post"),
    })
    expect(workers[0].terminated).toBe(true)
    expect(host.getDiagnostics()).toMatchObject({
      activeWorkers: 0,
      runningJobs: 0,
      queuedJobs: 0,
      pendingJobs: 0,
      createdWorkers: 1,
      startedJobs: 0,
      failedJobs: 1,
    })

    await expect(host.run(square)).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    expect(attempts).toBe(2)
    expect(host.getDiagnostics()).toMatchObject({
      createdWorkers: 2,
      completedJobs: 1,
      failedJobs: 1,
      pendingJobs: 0,
    })
    host.destroy()
  })

  it("falls back to in-process execution on messageerror", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const pending = host.run(square)
    workers[0].onmessageerror?.({ message: "deserialize failed" })
    await expect(pending).resolves.toEqual({
      type: "area",
      squareMeters: expect.any(Number),
    })
    expect(workers[0].terminated).toBe(true)
    expect(workers[0].onmessageerror).toBeNull()
    expect(host.getDiagnostics()).toMatchObject({
      workerUnavailable: true,
      activeWorkers: 0,
      pendingJobs: 0,
      completedJobs: 1,
      failedJobs: 0,
    })
    host.destroy()
  })

  it("propagates fallback failures once without retrying the worker", async () => {
    const workers: FakeWorker[] = []
    let fallbacks = 0
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
      executeCooperative: async () => {
        fallbacks += 1
        throw new Arc3DError("ENGINE_FAILURE", "fallback failed")
      },
    })
    const pending = host.run(square)
    const request = workers[0].requests[0]
    const staleHandler = workers[0].onmessage
    workers[0].onerror?.({ message: "worker crashed" })
    await expect(pending).rejects.toMatchObject({
      code: "ENGINE_FAILURE",
      message: "fallback failed",
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    staleHandler?.({
      data: { id: request.id, result: executeAnalysisJob(square) },
    })
    expect(fallbacks).toBe(1)
    expect(host.getDiagnostics()).toMatchObject({
      pendingJobs: 0,
      inProcessJobs: 0,
      completedJobs: 0,
      failedJobs: 1,
      cancelledJobs: 0,
    })
    host.destroy()
  })

  it("settles cancellation once when a worker error races an abort", async () => {
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
    workers[0].onerror?.({ message: "worker crashed" })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.getDiagnostics()).toMatchObject({
      pendingJobs: 0,
      inProcessJobs: 0,
      completedJobs: 0,
      cancelledJobs: 1,
      failedJobs: 0,
    })
    host.destroy()
  })

  it("does not dispatch a fallback that was queued before destroy", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    const pending = host.run(square)
    workers[0].onerror?.({ message: "worker crashed" })
    host.destroy()
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.getDiagnostics()).toMatchObject({
      terminated: true,
      pendingJobs: 0,
      inProcessJobs: 0,
      completedJobs: 0,
      cancelledJobs: 1,
      failedJobs: 0,
    })
  })

  it("keeps queue counters consistent under backpressure", async () => {
    const host = new AnalysisJobHost({
      maxWorkers: 2,
      maxQueue: 3,
      createWorker: () => new FakeWorker(),
    })
    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        host.run(square).catch((error: unknown) => error),
      ),
    )
    const failures = results.filter(
      (result): result is Arc3DError => result instanceof Arc3DError,
    )
    expect(failures).toHaveLength(45)
    expect(failures.every((error) => error.code === "QUEUE_FULL")).toBe(true)
    expect(
      results.filter((result) => !(result instanceof Arc3DError)),
    ).toHaveLength(5)
    const diagnostics = host.getDiagnostics()
    expect(diagnostics).toMatchObject({
      activeWorkers: 2,
      idleWorkers: 2,
      runningJobs: 0,
      queuedJobs: 0,
      pendingJobs: 0,
      startedJobs: 5,
      completedJobs: 5,
      failedJobs: 45,
      cancelledJobs: 0,
      rejectedJobs: 45,
    })
    expect(
      diagnostics.completedJobs +
        diagnostics.failedJobs -
        diagnostics.rejectedJobs +
        diagnostics.cancelledJobs,
    ).toBe(5)
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

  it("rejects jobs when structuredClone is unavailable", async () => {
    vi.stubGlobal("structuredClone", undefined)
    let created = 0
    const host = new AnalysisJobHost({
      createWorker: () => {
        created += 1
        return new FakeWorker()
      },
    })
    await expect(host.run(square)).rejects.toMatchObject({
      code: "UNSUPPORTED_CAPABILITY",
      message: expect.stringContaining("structuredClone"),
    })
    expect(created).toBe(0)
    host.destroy()
  })

  it("snapshots nested job inputs while queued", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    for (let i = 0; i < 4; i += 1) {
      host.run(square).catch(() => undefined)
    }
    expect(workers).toHaveLength(4)

    const graphics: Array<{
      id: string
      type: "point"
      positions: Array<{ longitude: number; latitude: number; height: number }>
    }> = [
      {
        id: "in",
        type: "point",
        positions: [{ longitude: 104.05, latitude: 30.55, height: 0 }],
      },
    ]
    const pending = host.run({
      type: "rect-query",
      graphics,
      rect: { west: 104, south: 30.5, east: 104.2, north: 30.7 },
    })

    graphics[0].id = "mutated"
    graphics[0].positions[0].longitude = 0
    graphics[0].positions[0].height = 999

    const first = workers[0].requests[0]
    workers[0].onmessage?.({
      data: { id: first.id, result: executeAnalysisJob(first.job) },
    })

    const queued = workers[0].requests[1]
    expect(queued.job).toMatchObject({
      type: "rect-query",
      graphics: [
        {
          id: "in",
          type: "point",
          positions: [{ longitude: 104.05, latitude: 30.55, height: 0 }],
        },
      ],
    })
    workers[0].onmessage?.({
      data: { id: queued.id, result: executeAnalysisJob(queued.job) },
    })
    await expect(pending).resolves.toEqual({
      type: "query",
      graphics: [{ id: "in", type: "point" }],
    })
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

  it("rejects new jobs when the queue is full", async () => {
    const workers: FakeWorker[] = []
    const host = new AnalysisJobHost({
      maxWorkers: 1,
      maxQueue: 1,
      createWorker: () => {
        const worker = new FakeWorker(undefined, false)
        workers.push(worker)
        return worker
      },
    })
    host.run(square).catch(() => undefined)
    host.run(square).catch(() => undefined)
    await expect(host.run(square)).rejects.toMatchObject({
      code: "QUEUE_FULL",
    })
    expect(host.getDiagnostics()).toMatchObject({
      maxWorkers: 1,
      maxQueue: 1,
      activeWorkers: 1,
      runningJobs: 1,
      queuedJobs: 1,
      pendingJobs: 2,
      startedJobs: 1,
      failedJobs: 1,
      rejectedJobs: 1,
    })
    host.destroy()
    expect(host.getDiagnostics()).toMatchObject({
      activeWorkers: 0,
      queuedJobs: 0,
      pendingJobs: 0,
      cancelledJobs: 2,
    })
  })

  it("drains the queue and reports execution counters", async () => {
    const host = new AnalysisJobHost({
      maxWorkers: 1,
      maxQueue: 4,
      createWorker: () => new FakeWorker(),
    })
    const results = await Promise.all([
      host.run(square),
      host.run(square),
      host.run(square),
    ])
    expect(results).toHaveLength(3)
    expect(host.getDiagnostics()).toMatchObject({
      activeWorkers: 1,
      idleWorkers: 1,
      createdWorkers: 1,
      reclaimedWorkers: 0,
      peakWorkers: 1,
      idleTimeoutMs: 30_000,
      runningJobs: 0,
      queuedJobs: 0,
      pendingJobs: 0,
      startedJobs: 3,
      completedJobs: 3,
      cancelledJobs: 0,
      failedJobs: 0,
      rejectedJobs: 0,
    })
    host.destroy()
  })

  it("removes cancelled jobs from the queue", async () => {
    const host = new AnalysisJobHost({
      maxWorkers: 1,
      maxQueue: 1,
      createWorker: () => new FakeWorker(undefined, false),
    })
    host.run(square).catch(() => undefined)
    const controller = new AbortController()
    const queued = host.run(square, { signal: controller.signal })
    queued.catch(() => undefined)
    expect(host.getDiagnostics().queuedJobs).toBe(1)

    controller.abort()
    await expect(queued).rejects.toMatchObject({ code: "CANCELLED" })
    expect(host.getDiagnostics()).toMatchObject({
      queuedJobs: 0,
      pendingJobs: 1,
      cancelledJobs: 1,
    })
    host.destroy()
  })

  it("reclaims idle workers after the timeout and recreates them on demand", async () => {
    vi.useFakeTimers()
    try {
      const workers: FakeWorker[] = []
      const host = new AnalysisJobHost({
        idleTimeoutMs: 1_000,
        createWorker: () => {
          const worker = new FakeWorker()
          workers.push(worker)
          return worker
        },
      })
      await host.run(square)
      expect(host.getDiagnostics()).toMatchObject({
        createdWorkers: 1,
        peakWorkers: 1,
        reclaimedWorkers: 0,
        idleWorkers: 1,
      })

      vi.advanceTimersByTime(999)
      expect(workers[0].terminated).toBe(false)
      expect(host.getDiagnostics().activeWorkers).toBe(1)

      vi.advanceTimersByTime(1)
      expect(workers[0].terminated).toBe(true)
      expect(workers[0].terminateCalls).toBe(1)
      expect(host.getDiagnostics()).toMatchObject({
        activeWorkers: 0,
        idleWorkers: 0,
        createdWorkers: 1,
        reclaimedWorkers: 1,
      })

      vi.advanceTimersByTime(60_000)
      expect(workers[0].terminateCalls).toBe(1)
      expect(host.getDiagnostics().reclaimedWorkers).toBe(1)

      await host.run(square)
      expect(workers).toHaveLength(2)
      expect(host.getDiagnostics()).toMatchObject({
        activeWorkers: 1,
        createdWorkers: 2,
        peakWorkers: 1,
        reclaimedWorkers: 1,
      })
      host.destroy()
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps idle workers when reclamation is disabled", async () => {
    vi.useFakeTimers()
    try {
      const workers: FakeWorker[] = []
      const host = new AnalysisJobHost({
        idleTimeoutMs: 0,
        createWorker: () => {
          const worker = new FakeWorker()
          workers.push(worker)
          return worker
        },
      })
      await host.run(square)
      vi.advanceTimersByTime(60_000)
      expect(host.getDiagnostics()).toMatchObject({
        idleTimeoutMs: 0,
        activeWorkers: 1,
        createdWorkers: 1,
        reclaimedWorkers: 0,
      })
      expect(workers[0].terminated).toBe(false)
      host.destroy()
    } finally {
      vi.useRealTimers()
    }
  })

  it("cancels idle reclamation timers on destroy", async () => {
    vi.useFakeTimers()
    try {
      const workers: FakeWorker[] = []
      const host = new AnalysisJobHost({
        idleTimeoutMs: 1_000,
        createWorker: () => {
          const worker = new FakeWorker()
          workers.push(worker)
          return worker
        },
      })
      await host.run(square)
      host.destroy()
      vi.advanceTimersByTime(60_000)
      expect(workers[0].terminateCalls).toBe(1)
      expect(host.getDiagnostics()).toMatchObject({
        terminated: true,
        activeWorkers: 0,
        reclaimedWorkers: 0,
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it("reuses an idle worker before its timeout expires", async () => {
    vi.useFakeTimers()
    try {
      const workers: FakeWorker[] = []
      const host = new AnalysisJobHost({
        maxWorkers: 1,
        idleTimeoutMs: 1_000,
        createWorker: () => {
          const worker = new FakeWorker()
          workers.push(worker)
          return worker
        },
      })
      await host.run(square)
      vi.advanceTimersByTime(500)
      await host.run(square)
      vi.advanceTimersByTime(500)
      expect(host.getDiagnostics()).toMatchObject({
        activeWorkers: 1,
        createdWorkers: 1,
        reclaimedWorkers: 0,
      })
      expect(workers).toHaveLength(1)
      host.destroy()
    } finally {
      vi.useRealTimers()
    }
  })

  it("rejects invalid idle timeout values", () => {
    for (const idleTimeoutMs of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      2_147_483_648,
    ]) {
      expect(() => new AnalysisJobHost({ idleTimeoutMs })).toThrowError(
        expect.objectContaining({ code: "INVALID_ARGUMENT" }),
      )
    }
  })

  it("keeps worker pools and diagnostics isolated per host", () => {
    const create = (maxWorkers: number) => {
      const workers: FakeWorker[] = []
      const host = new AnalysisJobHost({
        maxWorkers,
        createWorker: () => {
          const worker = new FakeWorker(undefined, false)
          workers.push(worker)
          return worker
        },
      })
      return { host, workers }
    }
    const first = create(1)
    const second = create(2)
    first.host.run(square).catch(() => undefined)
    first.host.run(square).catch(() => undefined)
    second.host.run(square).catch(() => undefined)
    second.host.run(square).catch(() => undefined)

    expect(first.workers).toHaveLength(1)
    expect(second.workers).toHaveLength(2)
    expect(first.host.getDiagnostics()).toMatchObject({
      activeWorkers: 1,
      queuedJobs: 1,
    })
    expect(second.host.getDiagnostics()).toMatchObject({
      activeWorkers: 2,
      queuedJobs: 0,
    })
    first.host.destroy()
    second.host.destroy()
  })

  it("does not start an in-process job cancelled before dispatch", async () => {
    let executed = 0
    const host = new AnalysisJobHost({
      createWorker: () => undefined,
      execute: () => {
        executed += 1
        return executeAnalysisJob(square)
      },
    })
    const controller = new AbortController()
    const pending = host.run(square, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" })
    expect(executed).toBe(0)
    expect(host.getDiagnostics()).toMatchObject({
      inProcessCancellation: "completion-only",
      inProcessJobs: 0,
      cancelledJobs: 1,
    })
    host.destroy()
  })

  it("cannot interrupt a non-chunkable in-process job", async () => {
    const controller = new AbortController()
    let executed = 0
    const host = new AnalysisJobHost({
      createWorker: () => undefined,
      execute: () => {
        executed += 1
        controller.abort()
        return executeAnalysisJob(square)
      },
    })
    await expect(
      host.run(square, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "CANCELLED" })
    expect(executed).toBe(1)
    expect(host.getDiagnostics()).toMatchObject({
      inProcessCancellation: "completion-only",
      inProcessJobs: 0,
      startedJobs: 1,
      cancelledJobs: 1,
    })
    host.destroy()
  })

  it("uses a cooperative executor for in-process cancellation", async () => {
    const controller = new AbortController()
    let executed = 0
    const host = new AnalysisJobHost({
      createWorker: () => undefined,
      executeCooperative: async (job, options) => {
        executed += 1
        await options.yieldToEventLoop()
        controller.abort()
        if (options.signal?.aborted) {
          throw new Arc3DError("CANCELLED", "Cancelled analysis job")
        }
        return executeAnalysisJob(job)
      },
    })
    await expect(
      host.run(square, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "CANCELLED" })
    expect(executed).toBe(1)
    expect(host.getDiagnostics()).toMatchObject({
      inProcessCancellation: "cooperative",
      inProcessJobs: 0,
      cancelledJobs: 1,
    })
    host.destroy()
  })

  it("rejects invalid pool configuration", () => {
    for (const maxWorkers of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() => new AnalysisJobHost({ maxWorkers })).toThrowError(
        /maxWorkers/,
      )
    }
    for (const maxQueue of [-1, 1.5, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(() => new AnalysisJobHost({ maxQueue })).toThrowError(/maxQueue/)
    }
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
