import { describe, expect, it } from "vitest"
import { Arc3DError, LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { FloodAnalysis } from "@arc3dlab/analysis"

/**
 * Cesium 的 `Material` 在识别 uniform 类型时会引用浏览器全局构造函数，
 * 这里在 node 环境下补齐桩对象，避免 `instanceof` 抛错。
 */
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

interface FakePrimitive {
  clippingPlanes?: unknown
}

function makeContext(): {
  flood: FloodAnalysis
  primitives: FakePrimitive[]
  demandCount: () => number
} {
  const primitives: FakePrimitive[] = []
  const viewer = {
    scene: {
      primitives: {
        add(primitive: FakePrimitive): FakePrimitive {
          primitives.push(primitive)
          return primitive
        },
        remove(primitive: FakePrimitive): void {
          const index = primitives.indexOf(primitive)
          if (index >= 0) primitives.splice(index, 1)
        },
      },
    },
  }
  let demands = 0
  const engineViewer = {
    acquireContinuousRender: () => {
      demands += 1
      return () => {
        demands -= 1
      }
    },
  }
  const context = {
    lifecycle: new LifecycleManager(),
    engine: { native: { viewer }, viewer: engineViewer },
  } as unknown as Arc3DContext
  return {
    flood: new FloodAnalysis(context),
    primitives,
    demandCount: () => demands,
  }
}

const region: Array<[number, number]> = [
  [116.39, 39.9],
  [116.41, 39.9],
  [116.4, 39.92],
]

describe("FloodAnalysis water surface", () => {
  it("requires a region before rendering water", () => {
    const { flood } = makeContext()
    expect(() => flood.setWaterLevel(10)).toThrow(Arc3DError)
  })

  it("rejects regions with fewer than three vertices", () => {
    const { flood } = makeContext()
    expect(() => flood.setRegion([region[0], region[1]])).toThrow(Arc3DError)
  })

  it("renders and clears a water polygon primitive", () => {
    const { flood, primitives } = makeContext()
    flood.setRegion(region)
    flood.setWaterLevel(25)
    expect(primitives).toHaveLength(1)
    flood.clear()
    expect(primitives).toHaveLength(0)
  })

  it("renders water from an extent rectangle", () => {
    const { flood, primitives } = makeContext()
    flood.setExtent([116.39, 39.9, 116.41, 39.92])
    flood.setWaterLevel(10)
    expect(primitives).toHaveLength(1)
  })

  it("replaces the previous water surface on update", () => {
    const { flood, primitives } = makeContext()
    flood.setRegion(region)
    flood.setWaterLevel(10)
    flood.setWaterLevel(20)
    expect(primitives).toHaveLength(1)
  })

  it("releases the primitive on destroy", () => {
    const { flood, primitives } = makeContext()
    flood.setExtent([116.39, 39.9, 116.41, 39.92])
    flood.setWaterLevel(10)
    flood.destroy()
    expect(primitives).toHaveLength(0)
  })

  it("holds continuous rendering only while water is visible", () => {
    const { flood, demandCount } = makeContext()
    flood.setRegion(region)
    expect(demandCount()).toBe(0)
    flood.setWaterLevel(10)
    expect(demandCount()).toBe(1)
    flood.clear()
    expect(demandCount()).toBe(0)
  })
})
