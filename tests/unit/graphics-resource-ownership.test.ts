import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  EventBus,
  LifecycleManager,
  ResourceRegistry,
  type Arc3DEvents,
  type Arc3DContext,
} from "@arc3dlab/core"
import { GraphicManager, type VoxelPoint } from "@arc3dlab/graphics"

function installDomStubs(): void {
  const scope = globalThis as Record<string, unknown>
  for (const name of [
    "HTMLCanvasElement",
    "HTMLImageElement",
    "ImageBitmap",
    "OffscreenCanvas",
  ]) {
    scope[name] ??= class {}
  }
}

installDomStubs()

const points: VoxelPoint[] = [
  { x: 116.38, y: 39.9, z: 0, value: 0 },
  { x: 116.39, y: 39.9, z: 10, value: 50 },
  { x: 116.4, y: 39.91, z: 20, value: 100 },
]

function makeManager(): {
  manager: GraphicManager
  registry: ResourceRegistry
  primitives: unknown[]
  lifecycle: LifecycleManager
} {
  const primitives: unknown[] = []
  const viewer = {
    entities: {
      add: (options: { id: string }) => ({
        id: options.id,
        show: true,
        position: undefined,
      }),
      remove: () => {},
      removeById: () => {},
    },
    scene: {
      primitives: {
        add(primitive: unknown): unknown {
          primitives.push(primitive)
          return primitive
        },
        remove(primitive: unknown): void {
          const index = primitives.indexOf(primitive)
          if (index >= 0) primitives.splice(index, 1)
        },
      },
    },
  }
  const lifecycle = new LifecycleManager()
  lifecycle.transition("initializing")
  lifecycle.transition("ready")
  const registry = new ResourceRegistry()
  const context = {
    lifecycle,
    registry,
    events: new EventBus<Arc3DEvents>(),
    engine: { native: { viewer }, viewer: { requestRender: () => {} } },
  } as unknown as Arc3DContext
  return {
    manager: new GraphicManager(context),
    registry,
    primitives,
    lifecycle,
  }
}

describe("GraphicManager 体素所有权", () => {
  it("registers a voxel into the shared registry as a resource handle", () => {
    const { manager, registry } = makeManager()
    const voxel = manager.addVoxel(points, { dimensions: 4 })
    expect(voxel.type).toBe("voxel")
    expect(voxel.owned).toBe(true)
    expect(typeof voxel.destroy).toBe("function")
    expect(registry.has(voxel.id)).toBe(true)
    expect(registry.get(voxel.id)).toBe(voxel)
  })

  it("releases voxel resources through GraphicManager.clear", () => {
    const { manager, registry, primitives } = makeManager()
    const voxel = manager.addVoxel(points, { dimensions: 4 })
    voxel.showPoints(true)
    expect(primitives.length).toBeGreaterThan(0)
    manager.clear()
    expect(primitives).toHaveLength(0)
    expect(registry.has(voxel.id)).toBe(false)
  })

  it("keeps destroy idempotent", () => {
    const { manager, registry } = makeManager()
    const voxel = manager.addVoxel(points, { dimensions: 3 })
    voxel.destroy()
    expect(() => voxel.destroy()).not.toThrow()
    expect(registry.remove(voxel.id)).toBe(true)
  })
})

describe("GraphicManager 压平所有权", () => {
  it("registers a flatten into the shared registry and detaches on clear", () => {
    const { manager, registry } = makeManager()
    const target: { clippingPolygons?: unknown } = {}
    const flatten = manager.addFlatten(target)
    expect(flatten.type).toBe("flatten")
    expect(flatten.owned).toBe(true)
    expect(registry.has(flatten.id)).toBe(true)
    expect(target.clippingPolygons).toBeDefined()
    manager.clear()
    expect(registry.has(flatten.id)).toBe(false)
    expect(target.clippingPolygons).toBeUndefined()
  })

  it("does not overwrite an externally replaced clipping collection", () => {
    const { manager } = makeManager()
    const target: { clippingPolygons?: unknown } = {}
    const flatten = manager.addFlatten(target)
    const external = { external: true }
    target.clippingPolygons = external
    flatten.destroy()
    expect(target.clippingPolygons).toBe(external)
    expect(() => flatten.destroy()).not.toThrow()
  })
})

describe("GraphicManager 生命周期门禁", () => {
  it("rejects voxel and flatten creation after the app is destroyed", () => {
    const { manager, lifecycle } = makeManager()
    lifecycle.transition("destroying")
    for (const create of [
      () => manager.addVoxel(points),
      () => manager.addFlatten(),
    ]) {
      try {
        create()
        throw new Error("expected addVoxel/addFlatten to throw")
      } catch (error) {
        expect(error).toBeInstanceOf(Arc3DError)
        expect((error as Arc3DError).code).toBe("APP_DESTROYED")
      }
    }
  })
})

describe("ManagedGraphic 坐标副本", () => {
  it("returns a defensive copy of positions", () => {
    const { manager } = makeManager()
    const graphic = manager.addPoint({
      positions: [{ longitude: 1, latitude: 2, height: 3 }],
    })
    const first = graphic.positions
    expect(first[0]).toEqual({ longitude: 1, latitude: 2, height: 3 })
    first[0]!.longitude = 999
    expect(graphic.positions[0]!.longitude).toBe(1)
  })
})
