import { describe, expect, it } from "vitest"
import { type Arc3DContext, LifecycleManager } from "@arc3dlab/core"
import {
  ModelFlatten,
  MultiTileVoxel,
  type VoxelPoint,
} from "@arc3dlab/graphics"

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

function makeContext(): {
  context: Arc3DContext
  primitives: unknown[]
} {
  const primitives: unknown[] = []
  const viewer = {
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
  const context = {
    lifecycle: new LifecycleManager(),
    engine: { native: { viewer } },
  } as unknown as Arc3DContext
  return { context, primitives }
}

const points: VoxelPoint[] = [
  { x: 116.38, y: 39.9, z: 0, value: 0 },
  { x: 116.39, y: 39.9, z: 10, value: 50 },
  { x: 116.4, y: 39.91, z: 20, value: 100 },
]

describe("MultiTileVoxel", () => {
  it("interpolates the nearest point value", () => {
    const { context } = makeContext()
    const voxel = new MultiTileVoxel(context, points, { dimensions: 4 })
    expect(voxel.interpolate(116.39, 39.9, 10)).toBe(50)
    expect(voxel.interpolate(116.4, 39.91, 20)).toBe(100)
  })

  it("returns voxel tile data", async () => {
    const { context } = makeContext()
    const voxel = new MultiTileVoxel(context, points, { dimensions: 4 })
    const data = await voxel.requestData({
      tileLevel: 0,
      tileX: 0,
      tileY: 0,
      tileZ: 0,
    })
    expect(data).toBeDefined()
    expect(data![0]).toBeInstanceOf(Float32Array)
    expect(data![0].length).toBe(4 ** 3 * 4)
  })

  it("rejects unsupported tile levels", () => {
    const { context } = makeContext()
    const voxel = new MultiTileVoxel(context, points)
    expect(
      voxel.requestData({ tileLevel: 1, tileX: 0, tileY: 0, tileZ: 0 }),
    ).toBeUndefined()
  })

  it("toggles points and releases primitives on destroy", () => {
    const { context, primitives } = makeContext()
    const voxel = new MultiTileVoxel(context, points)
    const before = primitives.length
    voxel.showPoints(true)
    expect(primitives.length).toBeGreaterThan(before)
    voxel.destroy()
    expect(primitives.length).toBe(0)
    expect(() => voxel.destroy()).not.toThrow()
  })
})

describe("ModelFlatten", () => {
  const polygon: Array<[number, number]> = [
    [116.38, 39.89],
    [116.4, 39.89],
    [116.39, 39.91],
  ]

  it("attaches a clipping collection to the target", () => {
    const { context } = makeContext()
    const target: { clippingPolygons?: unknown } = {}
    const flatten = new ModelFlatten(context, target)
    expect(target.clippingPolygons).toBeDefined()
    expect(flatten.count).toBe(0)
    expect(flatten.addPolygon(polygon)).toBe(0)
    expect(flatten.count).toBe(1)
    expect(flatten.enabled).toBe(true)
  })

  it("toggles enablement and clears polygons", () => {
    const { context } = makeContext()
    const flatten = new ModelFlatten(context)
    flatten.addPolygon(polygon)
    flatten.setEnabled(false)
    expect(flatten.enabled).toBe(false)
    flatten.clear()
    expect(flatten.count).toBe(0)
    expect(() => flatten.destroy()).not.toThrow()
  })
})
