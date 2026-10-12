import { describe, expect, it } from "vitest"
import { Arc3DError } from "@arc3dlab/core"
import { PluginManager } from "../../packages/sdk/src/plugins"
import { createTestContext } from "../fixtures/fake-context"

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe("PluginManager concurrency", () => {
  it("attributes extensions to the correct plugin when installs interleave", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    const gate = deferred<void>()
    const events: string[] = []

    const alpha = {
      name: "alpha",
      async install(_app: unknown, ctx: typeof context) {
        events.push("alpha:start")
        await gate.promise
        ctx.commands.register({
          name: "alpha.run",
          version: "1.0.0",
          plugin: "spoof",
          execute: () => 1,
        })
        ctx.tools.register({
          name: "alpha.tool",
          version: "1.0.0",
          plugin: "spoof",
          activate: () => undefined,
        })
        ctx.capabilities.register({
          name: "alpha:cap",
          provider: "spoof",
          version: "1.0.0",
          available: true,
        })
        events.push("alpha:end")
      },
    }
    const beta = {
      name: "beta",
      install(_app: unknown, ctx: typeof context) {
        events.push("beta:start")
        ctx.commands.register({
          name: "beta.run",
          version: "1.0.0",
          plugin: "spoof",
          execute: () => 1,
        })
        events.push("beta:end")
      },
    }

    const first = manager.use(alpha)
    const second = manager.use(beta)
    await Promise.resolve()
    expect(events).toEqual(["alpha:start"])

    gate.resolve()
    await Promise.all([first, second])

    expect(events).toEqual([
      "alpha:start",
      "alpha:end",
      "beta:start",
      "beta:end",
    ])
    expect(context.commands.get("alpha.run")?.plugin).toBe("alpha")
    expect(context.commands.get("beta.run")?.plugin).toBe("beta")
    expect(context.capabilities.get("alpha:cap")?.provider).toBe("alpha")
    const listed = Array.from(context.tools.list())
    expect(listed).toContain("alpha.tool")
  })

  it("rejects one of two concurrent installs with the same name", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    const plugin = { name: "dup", install: () => undefined }
    const results = await Promise.allSettled([
      manager.use(plugin),
      manager.use({ ...plugin }),
    ])
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toMatchObject({ code: "DUPLICATE_RESOURCE" })
    expect(context.scopes.list()).toEqual(["dup"])
  })

  it("removes only the plugin's own extensions on uninstall", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    await manager.use({
      name: "one",
      install: (_app, ctx) => {
        ctx.commands.register({
          name: "one.run",
          version: "1.0.0",
          plugin: "one",
          execute: () => 1,
        })
      },
    })
    await manager.use({
      name: "two",
      install: (_app, ctx) => {
        ctx.commands.register({
          name: "two.run",
          version: "1.0.0",
          plugin: "two",
          execute: () => 2,
        })
      },
    })

    await manager.uninstall("one")

    expect(context.commands.has("one.run")).toBe(false)
    expect(context.commands.has("two.run")).toBe(true)
    expect(manager.list()).toEqual(["two"])
  })
})

describe("PluginManager scope lifecycle", () => {
  it("reflects plugin state through the scope", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    let observed = ""
    await manager.use({
      name: "stateful",
      install: (_app, _ctx, scope) => {
        observed = scope.state
      },
    })
    const scope = context.scopes.get("stateful")
    expect(observed).toBe("installing")
    expect(scope?.state).toBe("installed")
    expect(manager.state("stateful")).toBe("installed")
  })

  it("rejects track() once the scope is closed", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    let captured: { closed: boolean; track: (d: () => void) => () => void } = {
      closed: false,
      track: () => () => undefined,
    }
    await manager.use({
      name: "closable",
      install: (_app, _ctx, scope) => {
        captured = scope
      },
    })
    await manager.uninstall("closable")
    expect(captured.closed).toBe(true)
    expect(() => captured.track(() => undefined)).toThrow(Arc3DError)
  })

  it("returns the scope count to zero after repeated install/uninstall", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    for (let index = 0; index < 20; index += 1) {
      await manager.use({
        name: "loop",
        install: (_app, _ctx, scope) => {
          scope.track(() => undefined)
        },
      })
      await manager.uninstall("loop")
    }
    expect(context.scopes.list()).toEqual([])
    expect(manager.states().loop).toBe("disposed")
  })
})
