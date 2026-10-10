import { describe, expect, it } from "vitest"
import { createPluginHarness } from "../fixtures/plugin-harness"
import { createMiningPlugin } from "../../examples/domain-plugins/mining-plugin"

describe("mining domain plugin", () => {
  it("loads sample graphics, layers, analysis, and UI on install", async () => {
    const host = createPluginHarness()
    const plugin = createMiningPlugin()
    await host.plugins.use(plugin)
    expect(plugin.status).toEqual({ state: "ready", loaded: 2, failed: 0 })
    expect(host.graphics.list()).toEqual(["mining-hole-1", "mining-hole-2"])
    expect(host.layers.list()).toEqual(["mining-site"])
    expect(host.ui.status).toContain("mining ready")
    const area = await host.context.commands.execute<{ squareMeters: number }>(
      "mining.analyze",
    )
    expect(area.squareMeters).toBeGreaterThan(0)
    await host.context.tools.activate("mining.inspect")
    expect(host.ui.status).toBe("mining inspect")
    await host.destroy()
  })

  it("uninstalls, then reinstalls without breaking core commands", async () => {
    const host = createPluginHarness()
    await host.plugins.use(createMiningPlugin())
    await host.plugins.uninstall("mining")
    expect(host.plugins.list()).toEqual([])
    expect(host.graphics.list()).toEqual([])
    expect(host.layers.list()).toEqual([])
    expect(host.context.commands.has("mining.load")).toBe(false)
    expect(host.context.tools.has("mining.inspect")).toBe(false)
    expect(host.context.capabilities.has("plugin:mining")).toBe(false)
    await expect(host.context.commands.execute("core.ping")).resolves.toBe(
      "pong",
    )
    expect(host.context.capabilities.has("analysis:measure")).toBe(true)

    await host.plugins.use(createMiningPlugin())
    expect(host.plugins.list()).toEqual(["mining"])
    expect(host.graphics.list()).toHaveLength(2)
    await host.destroy()
  })

  it("reports offline, auth, format, partial, and cancelled states", async () => {
    const host = createPluginHarness()
    const plugin = createMiningPlugin()
    await host.plugins.use(plugin)

    await expect(
      host.context.commands.execute("mining.load", {
        source: "network",
        offline: true,
      }),
    ).rejects.toMatchObject({ code: "NETWORK_FAILURE" })
    expect(plugin.status).toEqual({ state: "offline" })

    await expect(
      host.context.commands.execute("mining.load", { source: "network" }),
    ).rejects.toMatchObject({ code: "AUTH_FAILED" })
    expect(plugin.status.state).toBe("failed")

    await expect(
      host.context.commands.execute("mining.load", { format: "invalid" }),
    ).rejects.toMatchObject({ code: "INVALID_FORMAT" })

    const partial = await host.context.commands.execute("mining.load", {
      source: "memory",
      includeBroken: true,
    })
    expect(partial).toEqual({ state: "partial", loaded: 2, failed: 1 })
    expect(host.graphics.list()).toHaveLength(2)

    await host.context.commands.execute("mining.cancel")
    expect(plugin.status).toEqual({ state: "cancelled" })
    await host.destroy()
  })
})
