import { describe, expect, it } from "vitest"
import { ToolRegistry } from "@arc3dlab/core"
import { PluginManager } from "../../packages/sdk/src/plugins"
import { createTestContext } from "../fixtures/fake-context"

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("ToolRegistry serialized state machine", () => {
  it("keeps a single active tool under concurrent activations", async () => {
    const tools = new ToolRegistry()
    const order: string[] = []
    tools.register({
      name: "t.a",
      version: "1.0.0",
      plugin: "t",
      activate: async () => {
        await delay(5)
        order.push("a-on")
      },
      deactivate: () => {
        order.push("a-off")
      },
    })
    tools.register({
      name: "t.b",
      version: "1.0.0",
      plugin: "t",
      activate: async () => {
        order.push("b-on")
      },
      deactivate: () => {
        order.push("b-off")
      },
    })

    await Promise.all([tools.activate("t.a"), tools.activate("t.b")])

    expect(tools.activeTool).toBe("t.b")
    expect(order).toEqual(["a-on", "a-off", "b-on"])
  })

  it("removes the tool and aggregates errors when deactivate throws", async () => {
    const tools = new ToolRegistry()
    tools.register({
      name: "t.bad",
      version: "1.0.0",
      plugin: "p",
      activate: () => undefined,
      deactivate: () => {
        throw new Error("boom")
      },
    })
    tools.register({
      name: "t.good",
      version: "1.0.0",
      plugin: "p",
      activate: () => undefined,
      deactivate: () => undefined,
    })

    await tools.activate("t.bad")
    await expect(tools.unregisterByPlugin("p")).rejects.toThrow("boom")

    expect(tools.list()).toEqual([])
    expect(tools.activeTool).toBeUndefined()
  })

  it("rolls the previous tool back to active when its deactivate throws", async () => {
    const tools = new ToolRegistry()
    let failing = true
    tools.register({
      name: "t.a",
      version: "1.0.0",
      plugin: "p",
      activate: () => undefined,
      deactivate: () => {
        if (failing) throw new Error("off failed")
      },
    })
    tools.register({
      name: "t.b",
      version: "1.0.0",
      plugin: "p",
      activate: () => undefined,
    })

    await tools.activate("t.a")
    await expect(tools.activate("t.b")).rejects.toThrow("off failed")

    expect(tools.activeTool).toBe("t.a")
    expect(tools.state).toBe("active")

    failing = false
    await tools.deactivate()
    expect(tools.activeTool).toBeUndefined()
    expect(tools.state).toBe("idle")

    await tools.activate("t.b")
    expect(tools.activeTool).toBe("t.b")
    expect(tools.state).toBe("active")
  })
})

describe("Plugin extension cleanup robustness", () => {
  it("cleans all extension categories when a tool deactivation fails", async () => {
    const { context } = createTestContext()
    const manager = new PluginManager({ id: "app" }, context)
    await manager.use({
      name: "messy",
      install: (_app, ctx) => {
        ctx.commands.register({
          name: "messy.run",
          version: "1.0.0",
          plugin: "messy",
          execute: () => 1,
        })
        ctx.tools.register({
          name: "messy.tool",
          version: "1.0.0",
          plugin: "messy",
          activate: () => undefined,
          deactivate: () => {
            throw new Error("boom")
          },
        })
        ctx.capabilities.register({
          name: "messy:cap",
          provider: "messy",
          version: "1.0.0",
          available: true,
        })
      },
    })
    await context.tools.activate("messy.tool")

    await manager.uninstall("messy")

    expect(context.commands.has("messy.run")).toBe(false)
    expect(context.tools.has("messy.tool")).toBe(false)
    expect(context.capabilities.has("messy:cap")).toBe(false)
    expect(context.scopes.list()).toEqual([])
  })
})
