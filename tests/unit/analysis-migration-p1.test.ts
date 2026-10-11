import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { AnalysisManager } from "@arc3dlab/analysis"

const center = { longitude: 116.397, latitude: 39.909 }

interface FakeEntity {
  id: string
  show?: boolean
}

function makeContext(): Arc3DContext {
  const globe = {
    clippingPlanes: {
      enabled: false,
      removeAll() {},
      destroy() {},
    },
    clippingPolygons: { enabled: false, removeAll() {} },
    getHeight: () => 0,
  }
  const store = new Map<string, FakeEntity>()
  const entities = {
    add(entity: FakeEntity): FakeEntity {
      const id = entity.id ?? `entity-${store.size}`
      const stored = { ...entity, id }
      store.set(id, stored)
      return stored
    },
    getById(id: string): FakeEntity | undefined {
      return store.get(id)
    },
    removeById(id: string): void {
      store.delete(id)
    },
  }
  const viewer = {
    scene: { globe, splitPosition: 0, sampleHeightSupported: false },
    entities,
  }
  return {
    lifecycle: new LifecycleManager(),
    engine: { native: { viewer } },
  } as Arc3DContext
}

describe("AnalysisManager P1 services", () => {
  it("exposes and disposes the migrated analysis services", () => {
    const manager = new AnalysisManager(makeContext())
    expect(manager.buffer).toBeDefined()
    expect(manager.path).toBeDefined()
    expect(manager.heatmap).toBeDefined()
    expect(manager.dynamicHeatmap).toBeDefined()
    expect(manager.flood).toBeDefined()
    expect(manager.swipe).toBeDefined()
    manager.destroy()
  })

  it("builds buffer rings through the buffer service", () => {
    const manager = new AnalysisManager(makeContext())
    const ring = manager.buffer.point(center, 500, 32)
    expect(ring.length).toBe(33)
    expect(ring[0]).toEqual(ring[ring.length - 1])
    manager.destroy()
  })

  it("analyses flooding through the flood service", () => {
    const manager = new AnalysisManager(makeContext())
    const result = manager.flood.analyze({
      extent: [0, 0, 0.01, 0.01],
      width: 2,
      height: 2,
      heights: [1, 2, 3, 4],
      waterLevel: 3,
    })
    expect(result.floodedRatio).toBe(0.5)
    manager.destroy()
  })

  it("computes extended measurements", async () => {
    const manager = new AnalysisManager(makeContext())
    const triangle = await manager.measure.triangleArea({
      positions: [
        [116.39, 39.9],
        [116.41, 39.9],
        [116.4, 39.92],
      ],
    })
    expect(triangle.squareMeters).toBeGreaterThan(0)
    const slope = await manager.measure.slope({
      from: { ...center, height: 0 },
      to: { ...center, height: 100 },
    })
    expect(slope.degrees).toBe(90)
    manager.destroy()
  })
})
