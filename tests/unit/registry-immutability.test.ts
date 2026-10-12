import { describe, expect, it } from "vitest"
import { CapabilityRegistry, CommandBus } from "@arc3dlab/core"

describe("CommandBus read snapshots", () => {
  it("does not expose mutable internal command state", () => {
    const bus = new CommandBus()
    bus.register({
      name: "app.run",
      version: "1.0.0",
      plugin: "app",
      params: { value: { type: "string", required: true } },
      execute: (input) => input.value,
    })

    const fetched = bus.get("app.run")
    expect(fetched).toBeDefined()
    fetched!.plugin = "spoofed"
    fetched!.params!.value.required = false

    expect(bus.get("app.run")?.plugin).toBe("app")
    expect(bus.get("app.run")?.params?.value.required).toBe(true)
    expect(fetched!.plugin).toBe("spoofed")
  })

  it("keeps plugin-scoped cleanup correct after a snapshot is mutated", () => {
    const bus = new CommandBus()
    bus.register({
      name: "app.run",
      version: "1.0.0",
      plugin: "app",
      execute: () => 1,
    })
    const snapshot = bus.get("app.run")
    snapshot!.plugin = "other"

    bus.unregisterByPlugin("app")
    expect(bus.has("app.run")).toBe(false)
  })
})

describe("CapabilityRegistry read snapshots", () => {
  it("does not expose mutable internal capability state", () => {
    const registry = new CapabilityRegistry()
    registry.register({
      name: "render:entity",
      provider: "arc3dlab",
      version: "1.0.0",
      available: true,
    })

    const fetched = registry.get("render:entity")
    fetched!.provider = "spoofed"
    fetched!.available = false

    expect(registry.get("render:entity")?.provider).toBe("arc3dlab")
    expect(registry.has("render:entity")).toBe(true)

    const [record] = registry.records()
    record.provider = "spoofed"
    record.available = false
    expect(registry.get("render:entity")?.provider).toBe("arc3dlab")
    expect(registry.has("render:entity")).toBe(true)
  })

  it("keeps provider-scoped cleanup correct after a snapshot is mutated", () => {
    const registry = new CapabilityRegistry()
    registry.register({
      name: "plugin:thing",
      provider: "plugin",
      version: "1.0.0",
      available: true,
    })
    const snapshot = registry.get("plugin:thing")
    snapshot!.provider = "arc3dlab"

    registry.unregisterByProvider("plugin")
    expect(registry.get("plugin:thing")).toBeUndefined()
  })

  it("updates availability only through the explicit API", () => {
    const registry = new CapabilityRegistry()
    registry.register({
      name: "plugin:thing",
      provider: "plugin",
      version: "1.0.0",
      available: true,
    })

    expect(registry.updateAvailability("plugin:thing", false, "arc3dlab")).toBe(
      false,
    )
    expect(registry.has("plugin:thing")).toBe(true)
    expect(registry.updateAvailability("plugin:thing", false, "plugin")).toBe(
      true,
    )
    expect(registry.has("plugin:thing")).toBe(false)
    expect(registry.updateAvailability("missing", true)).toBe(false)
  })
})
