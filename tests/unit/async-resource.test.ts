import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  LifecycleManager,
  afterAwait,
  assertAlive,
} from "@arc3dlab/core"

describe("async resource gate", () => {
  it("allows work while the app is usable", () => {
    const lifecycle = new LifecycleManager()
    expect(() => assertAlive(lifecycle, "add layer")).not.toThrow()
  })

  it("disposes the native object when the app is destroyed after await", async () => {
    const lifecycle = new LifecycleManager()
    lifecycle.transition("destroying")
    lifecycle.transition("destroyed")
    let disposed = false
    await expect(
      afterAwait(lifecycle, "add tileset", { id: "t-1" }, () => {
        disposed = true
      }),
    ).rejects.toMatchObject({ code: "APP_DESTROYED" })
    expect(disposed).toBe(true)
  })

  it("throws APP_DESTROYED without calling dispose when none is provided", () => {
    const lifecycle = new LifecycleManager()
    lifecycle.transition("destroying")
    expect(() => assertAlive(lifecycle, "set basemap")).toThrow(Arc3DError)
  })
})
