import { describe, expect, it } from "vitest"
import { PluginManager } from "../../packages/sdk/src/plugins"
import { createTestContext } from "../fixtures/fake-context"

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("PluginManager shutdown barrier", () => {
  it("rolls back an in-flight install when destroy starts", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    const gate = deferred<void>()

    const usePromise = manager.use({
      name: "slow",
      async install(_app, ctx) {
        ctx.commands.register({
          name: "slow.run",
          version: "1.0.0",
          plugin: "slow",
          execute: () => 1,
        })
        ctx.tools.register({
          name: "slow.tool",
          version: "1.0.0",
          plugin: "slow",
          activate: () => undefined,
        })
        ctx.capabilities.register({
          name: "slow:cap",
          version: "1.0.0",
          provider: "slow",
          available: true,
        })
        await gate.promise
      },
    })

    await tick()
    expect(context.commands.has("slow.run")).toBe(true)

    const destroyPromise = manager.destroy()
    expect(manager.shuttingDown).toBe(true)

    gate.resolve()

    await expect(usePromise).rejects.toMatchObject({ code: "CANCELLED" })
    await destroyPromise

    expect(manager.list()).toEqual([])
    expect(context.scopes.list()).toEqual([])
    expect(context.commands.has("slow.run")).toBe(false)
    expect(context.tools.has("slow.tool")).toBe(false)
    expect(context.capabilities.has("slow:cap")).toBe(false)
  })

  it("rejects new installs once shutting down", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    await manager.destroy()

    await expect(
      manager.use({ name: "late", install: () => undefined }),
    ).rejects.toMatchObject({ code: "CANCELLED" })
    expect(context.scopes.list()).toEqual([])
  })

  it("uninstalls installed plugins in reverse order on destroy", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    const order: string[] = []
    await manager.use({
      name: "first",
      install: (_app, ctx) => {
        ctx.commands.register({
          name: "first.run",
          version: "1.0.0",
          plugin: "first",
          execute: () => 1,
        })
      },
      uninstall: () => {
        order.push("first")
      },
    })
    await manager.use({
      name: "second",
      install: (_app, ctx) => {
        ctx.commands.register({
          name: "second.run",
          version: "1.0.0",
          plugin: "second",
          execute: () => 2,
        })
      },
      uninstall: () => {
        order.push("second")
      },
    })

    await manager.destroy()
    await manager.destroy()

    expect(order).toEqual(["second", "first"])
    expect(manager.list()).toEqual([])
    expect(context.commands.has("first.run")).toBe(false)
    expect(context.commands.has("second.run")).toBe(false)
  })

  it("rejects uninstall after the manager is closed", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    await manager.destroy()
    await expect(manager.uninstall("ghost")).rejects.toMatchObject({
      code: "CANCELLED",
    })
  })
})
