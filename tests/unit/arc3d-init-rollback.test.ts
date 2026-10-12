import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ destroys: 0, fail: false }))

vi.mock("@arc3dlab/engine-cesium", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@arc3dlab/engine-cesium")>()
  class FakeEngine {
    readonly type = "fake"
    destroy(): void {
      state.destroys += 1
    }
    hasCapability(): boolean {
      if (state.fail) throw new Error("capability boom")
      return true
    }
    mapError(error: unknown): { message: string } {
      return {
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return {
    ...actual,
    createCesiumEngineContext: () => {
      const engine = new FakeEngine()
      const viewer = {
        canvas: {},
        container: {},
        native: {},
        setCreditMode() {},
        requestRender() {},
        destroy() {
          state.destroys += 1
        },
      }
      return {
        type: "fake",
        viewer,
        native: { viewer: viewer.native },
        engine,
      }
    },
  }
})

import { Arc3D } from "../../src/index"

describe("Arc3D initialization rollback", () => {
  beforeEach(() => {
    state.destroys = 0
    state.fail = true
  })

  it("destroys the viewer and preserves the original error", async () => {
    await expect(Arc3D.create({ container: "map" })).rejects.toThrow(
      "capability boom",
    )
    expect(state.destroys).toBeGreaterThan(0)
  })

  it("does not accumulate resources across repeated failures", async () => {
    await expect(Arc3D.create({ container: "map" })).rejects.toThrow()
    await expect(Arc3D.create({ container: "map" })).rejects.toThrow()
    expect(state.destroys).toBe(2)
  })
})
