import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  ConsoleLogger,
  createContext,
  type Arc3DContext,
  type EngineViewer,
} from "@arc3dlab/core"
import { PluginManager } from "../../packages/sdk/src/plugins"

function context(): Arc3DContext {
  const viewer: EngineViewer = {
    canvas: {} as HTMLCanvasElement,
    container: { id: "plugin-test" } as Element,
    native: {},
    setCreditMode() {},
    requestRender() {},
    destroy() {},
  }
  return createContext(
    { container: "plugin-test" },
    { type: "fake", viewer, native: { viewer: viewer.native } },
    new ConsoleLogger("silent"),
  )
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
      }),
    ).rejects.toThrow("install failed")
    expect(uninstalled).toBe(true)
    expect(manager.list()).toEqual([])
  })

  it("rejects duplicate plugin names", async () => {
    const manager = new PluginManager({ id: "app" }, context())
    await manager.use({ name: "once", install: () => undefined })
    await expect(
      manager.use({ name: "once", install: () => undefined }),
    ).rejects.toMatchObject({
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
    await expect(
      manager.use({ name: "late", install: () => undefined }),
    ).rejects.toBeInstanceOf(Arc3DError)
  })
})

describe("PluginManager cleanup", () => {
  it("cleans extensions and scope even when uninstall throws", async () => {
    const ctx = context()
    const manager = new PluginManager({ id: "app" }, ctx)
    let disposed = false
    await manager.use({
      name: "messy",
      install: (_app, c, scope) => {
        c.commands.register({
          name: "messy.run",
          version: "1.0.0",
          plugin: "messy",
          execute: () => 1,
        })
        c.tools.register({
          name: "messy.tool",
          version: "1.0.0",
          plugin: "messy",
          activate: () => undefined,
        })
        c.capabilities.register({
          name: "messy:cap",
          provider: "messy",
          version: "1.0.0",
          available: true,
        })
        scope.track(() => {
          disposed = true
        })
      },
      uninstall: () => {
        throw new Error("uninstall failed")
      },
    })

    await manager.uninstall("messy")

    expect(manager.list()).toEqual([])
    expect(ctx.commands.has("messy.run")).toBe(false)
    expect(ctx.tools.has("messy.tool")).toBe(false)
    expect(ctx.capabilities.has("messy:cap")).toBe(false)
    expect(disposed).toBe(true)
  })

  it("prevents plugins from spoofing the core namespace", async () => {
    const ctx = context()
    const manager = new PluginManager({ id: "app" }, ctx)
    await expect(
      manager.use({
        name: "spoof",
        install: (_app, c) => {
          c.commands.register({
            name: "core.takeover",
            version: "1.0.0",
            plugin: "core",
            execute: () => 1,
          })
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
    expect(ctx.commands.has("core.takeover")).toBe(false)
    expect(manager.list()).toEqual([])
  })

  it("requires plugin dependencies to be installed first", async () => {
    const manager = new PluginManager({ id: "app" }, context())
    await expect(
      manager.use({
        name: "leaf",
        dependsOnPlugins: ["base"],
        install: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" })
  })

  it("blocks uninstalling a plugin that others depend on", async () => {
    const manager = new PluginManager({ id: "app" }, context())
    await manager.use({ name: "base", install: () => undefined })
    await manager.use({
      name: "leaf",
      dependsOnPlugins: ["base"],
      install: () => undefined,
    })
    await expect(manager.uninstall("base")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    })
    await manager.uninstall("leaf")
    await manager.uninstall("base")
    expect(manager.list()).toEqual([])
  })
})
