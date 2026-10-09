import { describe, expect, it } from "vitest"
import { Arc3DError, ConsoleLogger, LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { PluginManager } from "../../packages/sdk/src/plugins"

function context(): Arc3DContext {
  return {
    lifecycle: new LifecycleManager(),
    logger: new ConsoleLogger("silent"),
  } as unknown as Arc3DContext
}

describe("PluginManager", () => {
  it("rolls back a failed install", async () => {
    const ctx = context()
    const manager = new PluginManager({ id: "app" }, ctx)
    let uninstalled = false
    await expect(
      manager.use({
        name: "broken",
        install: () => {
          throw new Error("install failed")
        },
        uninstall: () => {
          uninstalled = true
        },
      })
    ).rejects.toThrow("install failed")
    expect(uninstalled).toBe(true)
    expect(manager.list()).toEqual([])
  })

  it("rejects duplicate plugin names", async () => {
    const manager = new PluginManager({ id: "app" }, context())
    await manager.use({ name: "once", install: () => undefined })
    await expect(manager.use({ name: "once", install: () => undefined })).rejects.toMatchObject({
      code: "DUPLICATE_RESOURCE",
    })
  })

  it("uninstalls plugins in reverse order on destroy", async () => {
    const manager = new PluginManager({ id: "app" }, context())
    const order: string[] = []
    await manager.use({
      name: "a",
      install: () => undefined,
      uninstall: () => {
        order.push("a")
      },
    })
    await manager.use({
      name: "b",
      install: () => undefined,
      uninstall: () => {
        order.push("b")
      },
    })
    await manager.destroy()
    expect(order).toEqual(["b", "a"])
    expect(manager.list()).toEqual([])
  })

  it("blocks install after destroy has started", async () => {
    const ctx = context()
    ctx.lifecycle.transition("destroying")
    const manager = new PluginManager({ id: "app" }, ctx)
    await expect(manager.use({ name: "late", install: () => undefined })).rejects.toBeInstanceOf(Arc3DError)
  })
})
