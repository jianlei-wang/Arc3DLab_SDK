import { describe, expect, it } from "vitest"
import {
  LifecycleManager,
  ResourceRegistry,
  type Arc3DContext,
} from "@arc3dlab/core"
import {
  AnalysisManager,
  SpatialQueryService,
  TerrainAnalysis,
  executeAnalysisJob,
  type AnalysisJob,
  type AnalysisWorkerLike,
} from "@arc3dlab/analysis"
import { Cartographic } from "cesium"

function baseContext(extra: Record<string, unknown> = {}): Arc3DContext {
  return {
    lifecycle: new LifecycleManager(),
    registry: new ResourceRegistry(),
    events: { emit() {} },
    ...extra,
  } as unknown as Arc3DContext
}

function terrainContext(
  heightAt: (longitude: number, latitude: number) => number,
): Arc3DContext {
  return baseContext({
    engine: {
      native: {
        viewer: {
          scene: {
            sampleHeightSupported: false,
            globe: {
              getHeight(carto: Cartographic) {
                return heightAt(
                  (carto.longitude * 180) / Math.PI,
                  (carto.latitude * 180) / Math.PI,
                )
              },
            },
          },
        },
      },
    },
  })
}

class FakeWorker implements AnalysisWorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  terminated = false
  readonly requests: Array<{ id: number; job: AnalysisJob }> = []

  postMessage(message: unknown): void {
    const request = message as { id: number; job: AnalysisJob }
    this.requests.push(request)
    queueMicrotask(() => {
      if (this.terminated) return
      this.onmessage?.({
        data: { id: request.id, result: executeAnalysisJob(request.job) },
      })
    })
  }

  terminate(): void {
    this.terminated = true
  }
}

class DeferredWorker implements AnalysisWorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  terminated = false
  readonly requests: Array<{ id: number; job: AnalysisJob }> = []

  postMessage(message: unknown): void {
    this.requests.push(message as { id: number; job: AnalysisJob })
  }

  respond(): void {
    const request = this.requests.at(-1)
    if (!request) throw new Error("DeferredWorker has no request")
    this.onmessage?.({
      data: { id: request.id, result: executeAnalysisJob(request.job) },
    })
  }

  terminate(): void {
    this.terminated = true
  }
}

describe("analysis task variants", () => {
  it("routes measurement and query through the shared task registry", async () => {
    const manager = new AnalysisManager(baseContext())

    const distance = await manager.measure.distanceTask({
      positions: [
        [120, 30],
        [120.01, 30],
      ],
    })
    expect(distance.status).toBe("succeeded")
    expect(distance.algorithm).toBe("measure.distance")
    expect(distance.units?.length).toBe("m")
    expect(distance.value?.meters ?? 0).toBeGreaterThan(0)
    expect(distance.spatialReference).toBeDefined()
    expect(manager.tasks.get(distance.taskId)?.status).toBe("succeeded")

    const query = await manager.query.rectangleTask({
      west: 120,
      south: 30,
      east: 121,
      north: 31,
    })
    expect(query.status).toBe("succeeded")
    expect(query.algorithm).toBe("query.rectangle")
    expect(query.value?.graphics).toEqual([])
    expect(manager.tasks.get(query.taskId)?.status).toBe("succeeded")
  })

  it("exposes terrain sampling state on the unified result", async () => {
    const terrain = new TerrainAnalysis(terrainContext(() => 42))
    const result = await terrain.sampleHeightTask({ position: [120, 30] })

    expect(result.status).toBe("succeeded")
    expect(result.algorithm).toBe("terrain.sampleHeight")
    expect(result.units?.length).toBe("m")
    expect(result.value?.height).toBeCloseTo(42, 5)
    expect(result.value?.status).toBeDefined()
    expect(result.verticalReference).toBeDefined()
  })

  it("returns a zeroed volume result without needing a viewer", async () => {
    const manager = new AnalysisManager(baseContext())
    const result = await manager.volume.cutFillTask({
      positions: [
        [120, 30],
        [120.01, 30],
      ],
    })
    expect(result.status).toBe("succeeded")
    expect(result.algorithm).toBe("volume.cutFill")
    expect(result.value?.sampleCount).toBe(0)
    expect(result.units?.volume).toBe("m3")
  })

  it("maps an aborted signal to a cancelled task", async () => {
    const manager = new AnalysisManager(baseContext())
    const controller = new AbortController()
    controller.abort()
    const result = await manager.volume.cutFillTask({
      positions: [[120, 30]],
      signal: controller.signal,
    })
    expect(result.status).toBe("cancelled")
    expect(result.error?.code).toBe("CANCELLED")
  })

  it("keeps a standalone query service task-capable", async () => {
    const query = new SpatialQueryService(baseContext())
    const result = await query.distanceTask({
      position: [120, 30],
      meters: 500,
    })
    expect(result.status).toBe("succeeded")
    expect(result.value?.graphics).toEqual([])
  })

  it("routes pure numeric tasks through the manager-owned worker host", async () => {
    const workers: FakeWorker[] = []
    const manager = new AnalysisManager(baseContext(), {
      createWorker: () => {
        const worker = new FakeWorker()
        workers.push(worker)
        return worker
      },
    })

    const area = await manager.measure.areaTask({
      positions: [
        [120, 30],
        [120.01, 30],
        [120.01, 30.01],
      ],
    })
    const query = await manager.query.rectangleTask({
      west: 120,
      south: 30,
      east: 121,
      north: 31,
    })

    expect(area.status).toBe("succeeded")
    expect(query.status).toBe("succeeded")
    expect(workers).toHaveLength(1)
    expect(workers[0].requests.map((request) => request.job.type)).toEqual([
      "area",
      "rect-query",
    ])

    manager.destroy()
    expect(workers[0].terminated).toBe(true)

    const afterDestroy = await manager.measure.distanceTask({
      positions: [
        [120, 30],
        [120.01, 30],
      ],
    })
    expect(afterDestroy.status).toBe("cancelled")
  })

  it("terminates the worker when a numeric task is cancelled", async () => {
    const workers: FakeWorker[] = []
    const manager = new AnalysisManager(baseContext(), {
      createWorker: () => {
        const worker = new FakeWorker()
        workers.push(worker)
        return worker
      },
    })
    const controller = new AbortController()
    const pending = manager.measure.distanceTask({
      positions: [
        [120, 30],
        [120.01, 30],
      ],
      signal: controller.signal,
    })
    controller.abort()

    const result = await pending
    expect(result.status).toBe("cancelled")
    expect(result.error?.code).toBe("CANCELLED")
    expect(workers[0].terminated).toBe(true)
    manager.destroy()
  })

  it("cancels only the worker owned by the aborted job", async () => {
    const workers: DeferredWorker[] = []
    const manager = new AnalysisManager(baseContext(), {
      createWorker: () => {
        const worker = new DeferredWorker()
        workers.push(worker)
        return worker
      },
    })
    const controller = new AbortController()
    const cancelled = manager.measure.distanceTask({
      positions: [
        [120, 30],
        [120.01, 30],
      ],
      signal: controller.signal,
    })
    const concurrent = manager.measure.distanceTask({
      positions: [
        [121, 31],
        [121.02, 31],
      ],
    })

    expect(workers).toHaveLength(2)
    controller.abort()
    const cancelledResult = await cancelled
    expect(cancelledResult.status).toBe("cancelled")
    expect(cancelledResult.error?.code).toBe("CANCELLED")
    expect(workers[0].terminated).toBe(true)
    expect(workers[1].terminated).toBe(false)

    workers[1].respond()
    const concurrentResult = await concurrent
    expect(concurrentResult.status).toBe("succeeded")
    expect(concurrentResult.value?.meters ?? 0).toBeGreaterThan(0)

    manager.destroy()
    expect(workers[1].terminated).toBe(true)
  })

  it("keeps scene-dependent terrain tasks on the main thread", async () => {
    const workers: FakeWorker[] = []
    const manager = new AnalysisManager(
      terrainContext(() => 42),
      {
        createWorker: () => {
          const worker = new FakeWorker()
          workers.push(worker)
          return worker
        },
      },
    )

    const result = await manager.terrain.sampleHeightTask({
      position: [120, 30],
    })
    expect(result.status).toBe("succeeded")
    expect(workers).toHaveLength(0)
    manager.destroy()
  })

  it("offloads only the pure grid step of cut fill", async () => {
    const workers: FakeWorker[] = []
    const manager = new AnalysisManager(
      terrainContext(() => 42),
      {
        createWorker: () => {
          const worker = new FakeWorker()
          workers.push(worker)
          return worker
        },
      },
    )

    const result = await manager.volume.cutFillTask({
      positions: [
        [120, 30],
        [120.01, 30],
        [120.01, 30.01],
        [120, 30.01],
      ],
      samples: 4,
    })
    expect(result.status).toBe("succeeded")
    expect(result.value?.status).toBe("computed")
    expect(workers[0]?.requests[0]?.job.type).toBe("cutfill-grid")
    manager.destroy()
  })
})
