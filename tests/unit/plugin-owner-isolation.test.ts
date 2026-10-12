import { describe, expect, it } from "vitest"
import type { PluginScope } from "@arc3dlab/core"
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

describe("Plugin owner isolation", () => {
  it("binds scope registrations to the plugin owner regardless of ambient state", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    await manager.use({
      name: "owner-test",
      install: (_app, _ctx, scope) => {
        scope.registerCommand({
          name: "owner-test.run",
          version: "1.0.0",
          execute: () => 1,
        })
        scope.registerTool({
          name: "owner-test.tool",
          version: "1.0.0",
          activate: () => undefined,
        })
        scope.registerCapability({
          name: "owner-test:cap",
          version: "1.0.0",
          available: true,
        })
      },
    })

    expect(context.commands.get("owner-test.run")?.plugin).toBe("owner-test")
    expect(context.tools.list().includes("owner-test.tool")).toBe(true)
    expect(context.capabilities.get("owner-test:cap")?.provider).toBe(
      "owner-test",
    )
  })

  it("does not capture queue-external registrations while a plugin installs", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    const gate = deferred<void>()

    const usePromise = manager.use({
      name: "paused",
      async install(_app, _ctx, scope) {
        scope.registerCommand({
          name: "paused.run",
          version: "1.0.0",
          execute: () => 1,
        })
        await gate.promise
      },
    })
    await tick()

    context.commands.register(
      {
        name: "app.run",
        version: "1.0.0",
        plugin: "app",
        execute: () => 2,
      },
      "app",
    )
    context.tools.register(
      {
        name: "app.tool",
        version: "1.0.0",
        plugin: "app",
        activate: () => undefined,
      },
      "app",
    )
    context.capabilities.register("app:cap", "app")

    gate.resolve()
    await usePromise

    expect(context.commands.get("app.run")?.plugin).toBe("app")
    await manager.uninstall("paused")

    expect(context.commands.has("paused.run")).toBe(false)
    expect(context.commands.get("app.run")?.plugin).toBe("app")
    expect(context.tools.list()).toContain("app.tool")
    expect(context.capabilities.get("app:cap")?.provider).toBe("app")
  })

  it("rejects scope registration after the scope is closed", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    let captured: PluginScope | undefined
    await manager.use({
      name: "late",
      install: (_app, _ctx, scope) => {
        captured = scope
      },
    })
    await manager.uninstall("late")
    expect(() =>
      captured?.registerCommand({
        name: "late.run",
        version: "1.0.0",
        execute: () => 1,
      }),
    ).toThrow()
  })
})
