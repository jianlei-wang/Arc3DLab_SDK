import { describe, expect, it } from "vitest"
import { type Arc3DContext, LifecycleManager } from "@arc3dlab/core"
import { MultiTileVoxel, type VoxelPoint } from "@arc3dlab/graphics"

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

interface Runtime {
  context: Arc3DContext
  primitives: unknown[]
}

function makeContext(): Runtime {
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

const TILE = { tileLevel: 0, tileX: 0, tileY: 0, tileZ: 0 }

function columnLength(matrix: readonly number[], column: number): number {
  const x = matrix[column * 4] ?? 0
  const y = matrix[column * 4 + 1] ?? 0
  const z = matrix[column * 4 + 2] ?? 0
  return Math.sqrt(x * x + y * y + z * z)
}

function modelMatrixOf(primitives: unknown[]): readonly number[] {
  return (primitives[0] as { modelMatrix: readonly number[] }).modelMatrix
}

describe("MultiTileVoxel interpolation contract", () => {
  it("returns the constant value when every point shares that value", () => {
    const { context } = makeContext()
    const points: VoxelPoint[] = [
      { x: 116.38, y: 39.9, z: 0, value: 7 },
      { x: 116.4, y: 39.92, z: 5, value: 7 },
    ]
    const voxel = new MultiTileVoxel(context, points, { dimensions: 4 })
    expect(voxel.interpolate(116.39, 39.91, 2)).toBeCloseTo(7, 6)
    expect(voxel.interpolate(116.3, 39.8, 0)).toBeCloseTo(7, 6)
  })

  it("weights interpolation by inverse squared distance", () => {
    const { context } = makeContext()
    const points: VoxelPoint[] = [
      { x: 116.39, y: 39.9, z: 0, value: 0 },
      { x: 116.41, y: 39.9, z: 0, value: 100 },
    ]
    const voxel = new MultiTileVoxel(context, points, { dimensions: 3 })
    expect(voxel.interpolate(116.4, 39.9, 0)).toBeCloseTo(50, 6)
    expect(voxel.interpolate(116.395, 39.9, 0)).toBeCloseTo(10, 6)
    expect(voxel.interpolate(116.405, 39.9, 0)).toBeCloseTo(90, 6)
  })

  it("returns the exact point value on a distance of zero", () => {
    const { context } = makeContext()
    const points: VoxelPoint[] = [
      { x: 116.39, y: 39.9, z: 0, value: 42 },
      { x: 116.41, y: 39.9, z: 0, value: 8 },
    ]
    const voxel = new MultiTileVoxel(context, points, { dimensions: 3 })
    expect(voxel.interpolate(116.41, 39.9, 0)).toBe(8)
  })

  it("supports the nearest neighbour method", () => {
    const { context } = makeContext()
    const points: VoxelPoint[] = [
      { x: 116.39, y: 39.9, z: 0, value: 0 },
      { x: 116.41, y: 39.9, z: 0, value: 100 },
    ]
    const voxel = new MultiTileVoxel(context, points, {
      dimensions: 3,
      method: "nearest",
    })
    expect(voxel.interpolate(116.395, 39.9, 0)).toBe(0)
    expect(voxel.interpolate(116.405, 39.9, 0)).toBe(100)
  })

  it("excludes NaN points from interpolation", () => {
    const { context } = makeContext()
    const points: VoxelPoint[] = [
      { x: 116.39, y: 39.9, z: 0, value: Number.NaN },
      { x: 116.41, y: 39.9, z: 0, value: 9 },
    ]
    const voxel = new MultiTileVoxel(context, points, { dimensions: 3 })
    expect(voxel.interpolate(116.39, 39.9, 0)).toBeCloseTo(9, 6)
  })

  it("returns NaN when every point is missing", () => {
    const { context } = makeContext()
    const points: VoxelPoint[] = [
      { x: 116.39, y: 39.9, z: 0, value: Number.NaN },
    ]
    const voxel = new MultiTileVoxel(context, points, { dimensions: 2 })
    expect(Number.isNaN(voxel.interpolate(116.39, 39.9, 0))).toBe(true)
  })

  it("produces grid values that depend on the input data", async () => {
    const { context } = makeContext()
    const base = [
      { x: 116.38, y: 39.9, z: 0 },
      { x: 116.4, y: 39.9, z: 0 },
    ]
    const ascending = new MultiTileVoxel(
      context,
      base.map((p, i) => ({ ...p, value: i * 100 })),
      { dimensions: 4 },
    )
    const descending = new MultiTileVoxel(
      context,
      base.map((p, i) => ({ ...p, value: (1 - i) * 100 })),
      { dimensions: 4 },
    )
    const a = await ascending.requestData(TILE)
    const b = await descending.requestData(TILE)
    expect(Array.from(a![0])).not.toEqual(Array.from(b![0]))
  })

  it("maps a constant data set to the high-value colour endpoint", async () => {
    const { context } = makeContext()
    const points: VoxelPoint[] = [
      { x: 116.39, y: 39.9, z: 0, value: 5 },
      { x: 116.4, y: 39.9, z: 0, value: 5 },
    ]
    const voxel = new MultiTileVoxel(context, points, { dimensions: 2 })
    const data = await voxel.requestData(TILE)
    const array = data![0]
    for (let i = 0; i < array.length; i += 4) {
      expect(array[i + 3]).toBe(1)
      expect(array[i]).toBeCloseTo(1, 6)
    }
  })

  it("emits transparent colours for an empty data set", async () => {
    const { context } = makeContext()
    const voxel = new MultiTileVoxel(context, [], { dimensions: 2 })
    const data = await voxel.requestData(TILE)
    const array = data![0]
    for (let i = 0; i < array.length; i += 4) {
      expect(array[i + 3]).toBe(0)
    }
  })

  it("sizes the vertical axis from the elevation span", () => {
    const { context, primitives } = makeContext()
    const points: VoxelPoint[] = [
      { x: 116.39, y: 39.9, z: 0, value: 0 },
      { x: 116.4, y: 39.9, z: 10, value: 1000 },
    ]
    new MultiTileVoxel(context, points, { dimensions: 2 })
    expect(columnLength(modelMatrixOf(primitives), 2)).toBeCloseTo(5, 6)
  })

  it("expands the box by the padding amount", () => {
    const { context, primitives } = makeContext()
    const points: VoxelPoint[] = [
      { x: 116.39, y: 39.9, z: 0, value: 0 },
      { x: 116.4, y: 39.9, z: 10, value: 100 },
    ]
    new MultiTileVoxel(context, points, { dimensions: 2, padding: 5 })
    expect(columnLength(modelMatrixOf(primitives), 2)).toBeCloseTo(10, 6)
  })

  it("does not create a primitive for an empty data set", () => {
    const { context, primitives } = makeContext()
    new MultiTileVoxel(context, [], { dimensions: 2 })
    expect(primitives).toHaveLength(0)
  })

  it("handles dimensions of one and rejects higher tile levels", async () => {
    const { context } = makeContext()
    const voxel = new MultiTileVoxel(
      context,
      [{ x: 116.39, y: 39.9, z: 0, value: 3 }],
      { dimensions: 1 },
    )
    const data = await voxel.requestData(TILE)
    expect(data![0]).toHaveLength(4)
    expect(
      voxel.requestData({ tileLevel: 1, tileX: 0, tileY: 0, tileZ: 0 }),
    ).toBeUndefined()
  })
})
