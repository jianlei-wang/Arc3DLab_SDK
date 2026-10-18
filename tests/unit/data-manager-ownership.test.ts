import { beforeEach, describe, expect, it, vi } from "vitest"

const fake = vi.hoisted(() => ({
  loaded: 0,
  failNext: false,
  pending: null as Promise<{ show: boolean; kind: string }> | null,
  source: { show: true, kind: "geojson-source" },
}))

vi.mock("cesium", async (importOriginal) => {
  const actual = await importOriginal<typeof import("cesium")>()
  return {
    ...actual,
    GeoJsonDataSource: {
      load: () => {
        fake.loaded += 1
        if (fake.failNext) {
          fake.failNext = false
          return Promise.reject(new Error("network down"))
        }
        if (fake.pending) return fake.pending
        return Promise.resolve(fake.source)
      },
    },
  }
})

import {
  Arc3DError,
  DataCatalog,
  EventBus,
  LifecycleManager,
  ResourceRegistry,
  type Arc3DEvents,
  type Arc3DContext,
} from "@arc3dlab/core"
import { DataManager } from "@arc3dlab/data"

function makeRuntime(): {
  manager: DataManager
  registry: ResourceRegistry
  catalog: DataCatalog
  lifecycle: LifecycleManager
} {
  const sources: unknown[] = []
  const viewer = {
    dataSources: {
      add: async (source: unknown) => {
        sources.push(source)
      },
      remove: (source: unknown) => {
        const index = sources.indexOf(source)
        if (index >= 0) sources.splice(index, 1)
      },
    },
  }
  const lifecycle = new LifecycleManager()
  lifecycle.transition("initializing")
  lifecycle.transition("ready")
  const registry = new ResourceRegistry()
  const catalog = new DataCatalog()
  const context = {
    lifecycle,
    registry,
    catalog,
    events: new EventBus<Arc3DEvents>(),
    engine: { native: { viewer } },
  } as unknown as Arc3DContext
  return { manager: new DataManager(context), registry, catalog, lifecycle }
}

describe("DataManager 资产所有权", () => {
  beforeEach(() => {
    fake.loaded = 0
    fake.failNext = false
    fake.pending = null
  })

  it("unregisters layer and asset when the handle is destroyed", async () => {
    const { manager, registry, catalog } = makeRuntime()
    const handle = await manager.add({
      id: "roads",
      type: "geojson",
      url: "https://example.com/roads.geojson",
    })
    expect(fake.loaded).toBe(1)
    expect(catalog.hasAsset("roads")).toBe(true)
    expect(catalog.getLayer("roads")?.loadState).toBe("ready")
    expect(registry.has("roads")).toBe(true)

    handle.destroy()
    expect(registry.has("roads")).toBe(false)
    expect(catalog.getLayer("roads")).toBeUndefined()
    expect(catalog.hasAsset("roads")).toBe(false)

    expect(() => handle.destroy()).not.toThrow()
    expect(catalog.hasAsset("roads")).toBe(false)
  })

  it("retries the same id after a failed load by resetting the failed record", async () => {
    const { manager, registry, catalog } = makeRuntime()
    fake.failNext = true

    await expect(
      manager.add({ id: "roads", type: "geojson", url: "u" }),
    ).rejects.toMatchObject({ code: "NETWORK_FAILURE" })
    expect(catalog.getLayer("roads")?.loadState).toBe("failed")
    expect(catalog.getLayer("roads")?.error?.code).toBe("NETWORK_FAILURE")
    expect(catalog.hasAsset("roads")).toBe(true)
    expect(registry.has("roads")).toBe(false)

    const handle = await manager.add({
      id: "roads",
      type: "geojson",
      url: "u",
    })
    expect(fake.loaded).toBe(2)
    expect(catalog.getLayer("roads")?.loadState).toBe("ready")
    expect(catalog.getLayer("roads")?.error).toBeUndefined()
    expect(registry.has("roads")).toBe(true)
    handle.destroy()
  })

  it("rejects the same id when an existing source is ready", async () => {
    const { manager } = makeRuntime()
    const handle = await manager.add({
      id: "roads",
      type: "geojson",
      url: "u",
    })
    await expect(
      manager.add({ id: "roads", type: "geojson", url: "u" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_RESOURCE" })
    handle.destroy()
  })

  it("rolls back catalog entries when loading finishes after destroy", async () => {
    const { manager, registry, catalog, lifecycle } = makeRuntime()
    let resolveLoad!: (source: typeof fake.source) => void
    fake.pending = new Promise((resolve) => {
      resolveLoad = resolve
    })
    const pending = manager.add({
      id: "roads",
      type: "geojson",
      url: "u",
    })
    expect(catalog.getLayer("roads")?.loadState).toBe("loading")

    lifecycle.transition("destroying")
    resolveLoad(fake.source)

    await expect(pending).rejects.toMatchObject({ code: "APP_DESTROYED" })
    expect(catalog.getLayer("roads")).toBeUndefined()
    expect(catalog.hasAsset("roads")).toBe(false)
    expect(registry.has("roads")).toBe(false)
    lifecycle.transition("destroyed")
  })

  it("rolls back when the load rejects after destroy", async () => {
    const { manager, registry, catalog, lifecycle } = makeRuntime()
    let rejectLoad!: (error: Error) => void
    fake.pending = new Promise((_resolve, reject) => {
      rejectLoad = reject
    })
    const pending = manager.add({
      id: "roads",
      type: "geojson",
      url: "u",
    })
    lifecycle.transition("destroying")
    rejectLoad(new Error("network down"))

    await expect(pending).rejects.toMatchObject({ code: "APP_DESTROYED" })
    expect(catalog.getLayer("roads")).toBeUndefined()
    expect(catalog.hasAsset("roads")).toBe(false)
    expect(registry.has("roads")).toBe(false)
    lifecycle.transition("destroyed")
  })

  it("rolls back layer and asset when registry registration fails", async () => {
    const { manager, registry, catalog } = makeRuntime()
    const spy = vi.spyOn(registry, "add").mockImplementationOnce(() => {
      throw new Arc3DError("DUPLICATE_RESOURCE", "collision")
    })
    await expect(
      manager.add({ id: "roads", type: "geojson", url: "u" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_RESOURCE" })
    expect(catalog.getLayer("roads")).toBeUndefined()
    expect(catalog.hasAsset("roads")).toBe(false)
    spy.mockRestore()
  })
})
