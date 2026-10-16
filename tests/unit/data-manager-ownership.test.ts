import { beforeEach, describe, expect, it, vi } from "vitest"

const fake = vi.hoisted(() => ({
  loaded: 0,
  source: { show: true, kind: "geojson-source" },
}))

vi.mock("cesium", async (importOriginal) => {
  const actual = await importOriginal<typeof import("cesium")>()
  return {
    ...actual,
    GeoJsonDataSource: {
      load: async () => {
        fake.loaded += 1
        return fake.source
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
  return { manager: new DataManager(context), registry, catalog }
}

describe("DataManager 资产所有权", () => {
  beforeEach(() => {
    fake.loaded = 0
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
