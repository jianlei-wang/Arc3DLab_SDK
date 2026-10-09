import { describe, expect, it } from "vitest"
import { Arc3DError, CommandBus, ToolRegistry } from "@arc3dlab/core"
import { createPluginHarness } from "../../packages/sdk/src/plugin-harness"

describe("CommandBus", () => {
  it("rejects reserved core command names from plugins", () => {
    const bus = new CommandBus()
    expect(() =>
      bus.register({
        name: "core.destroy",
        version: "1.0.0",
        plugin: "mining",
        execute: () => undefined,
      })
    ).toThrow(Arc3DError)
    try {
      bus.register({
        name: "arc3dlab.fly-to",
        version: "1.0.0",
        plugin: "mining",
        execute: () => undefined,
      })
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_ARGUMENT" })
    }
  })

  it("validates required params and duplicate names", async () => {
    const bus = new CommandBus()
    bus.register({
      name: "mining.echo",
      version: "1.0.0",
      plugin: "mining",
      params: { value: { type: "string", required: true } },
      execute: (input) => input.value,
    })
    await expect(bus.execute("mining.echo", { value: "ok" })).resolves.toBe("ok")
    await expect(bus.execute("mining.echo", {})).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    })
    expect(() =>
      bus.register({
        name: "mining.echo",
        version: "1.0.0",
        plugin: "mining",
        execute: () => undefined,
      })
    ).toThrow(Arc3DError)
    try {
      bus.register({
        name: "mining.echo",
        version: "1.0.0",
        plugin: "other",
        execute: () => undefined,
      })
    } catch (error) {
      expect(error).toMatchObject({ code: "DUPLICATE_RESOURCE" })
    }
  })
})

describe("ToolRegistry", () => {
  it("activates one tool at a time", async () => {
    const tools = new ToolRegistry()
    const order: string[] = []
    tools.register({
      name: "mining.inspect",
      version: "1.0.0",
      plugin: "mining",
      activate: () => {
        order.push("inspect-on")
      },
      deactivate: () => {
        order.push("inspect-off")
      },
    })
    tools.register({
      name: "mining.measure",
      version: "1.0.0",
      plugin: "mining",
      activate: () => {
        order.push("measure-on")
      },
    })
    await tools.activate("mining.inspect")
    await tools.activate("mining.measure")
    expect(tools.activeTool).toBe("mining.measure")
    expect(order).toEqual(["inspect-on", "inspect-off", "measure-on"])
  })
})

describe("plugin isolation harness", () => {
  it("keeps core commands after a plugin is uninstalled", async () => {
    const host = createPluginHarness()
    await host.plugins.use({
      name: "temp",
      install: (app, context) => {
        context.commands.register({
          name: "temp.hello",
          version: "1.0.0",
          plugin: "temp",
          execute: () => "hi",
        })
        app.graphics.add("temp-pt", "point")
      },
      uninstall: (app) => {
        app.graphics.remove("temp-pt")
      },
    })
    expect(host.context.commands.has("temp.hello")).toBe(true)
    expect(host.graphics.list()).toEqual(["temp-pt"])
    await host.plugins.uninstall("temp")
    expect(host.context.commands.has("temp.hello")).toBe(false)
    expect(host.graphics.list()).toEqual([])
    await expect(host.context.commands.execute("core.ping")).resolves.toBe("pong")
    expect(host.context.capabilities.has("engine:cesium")).toBe(true)
    expect(host.viewer).toBeDefined()
    await host.destroy()
    expect(host.engine.viewer).toBeUndefined()
  })

  it("rejects capability conflicts with a different provider", () => {
    const host = createPluginHarness()
    expect(() =>
      host.context.capabilities.register({
        name: "engine:cesium",
        provider: "mining",
        version: "9.0.0",
        available: true,
      })
    ).toThrow(Arc3DError)
    try {
      host.context.capabilities.register({
        name: "engine:cesium",
        provider: "mining",
        version: "9.0.0",
        available: true,
      })
    } catch (error) {
      expect(error).toMatchObject({ code: "DUPLICATE_RESOURCE" })
    }
  })
})
