import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  DataCatalog,
  type DataAsset,
  type LayerMetadata,
} from "@arc3dlab/core"

function asset(id: string, overrides: Partial<DataAsset> = {}): DataAsset {
  return {
    id,
    format: "geojson",
    uri: `https://data/${id}.geojson`,
    ...overrides,
  }
}

describe("DataCatalog", () => {
  it("registers assets, schemas and layers", () => {
    const catalog = new DataCatalog()
    catalog.registerAsset(
      asset("holes", {
        schema: {
          id: "holes-schema",
          geometryType: "point",
          fields: [
            { name: "grade", type: "number", unit: "g/t", required: true },
          ],
        },
      }),
    )
    expect(catalog.hasAsset("holes")).toBe(true)
    expect(catalog.listAssets()).toHaveLength(1)
    expect(catalog.getSchema("holes-schema")?.fields[0]).toMatchObject({
      name: "grade",
      type: "number",
    })
  })

  it("rejects duplicate assets and schemas", () => {
    const catalog = new DataCatalog()
    catalog.registerAsset(asset("a"))
    expect(() => catalog.registerAsset(asset("a"))).toThrow(Arc3DError)
    catalog.registerSchema({ id: "s", fields: [] })
    expect(() => catalog.registerSchema({ id: "s", fields: [] })).toThrow(
      Arc3DError,
    )
  })

  it("updates layer metadata in place", () => {
    const catalog = new DataCatalog()
    catalog.registerLayer({
      id: "overlay",
      kind: "imagery",
      visible: true,
      loadState: "loading",
    })
    expect(catalog.getLayer("overlay")?.loadState).toBe("loading")
    const updated = catalog.updateLayer("overlay", {
      loadState: "failed",
      error: { message: "tiles 404" },
    })
    expect(updated).toMatchObject({
      id: "overlay",
      loadState: "failed",
      visible: true,
    })
    expect(catalog.getLayer("overlay")?.error?.message).toBe("tiles 404")
  })

  it("keeps domain data when the rendering layer is removed", () => {
    const catalog = new DataCatalog()
    catalog.registerAsset(asset("city"))
    catalog.registerLayer({
      id: "city-layer",
      kind: "vector",
      assetId: "city",
      visible: true,
      loadState: "ready",
    })
    expect(
      catalog.resolveFeature({ featureId: "f1", assetId: "city" }).id,
    ).toBe("city")
    expect(catalog.unregisterLayer("city-layer")).toBe(true)
    expect(catalog.getLayer("city-layer")).toBeUndefined()
    expect(catalog.hasAsset("city")).toBe(true)
  })

  it("reports missing assets and clears cleanly", () => {
    const catalog = new DataCatalog()
    expect(() =>
      catalog.resolveFeature({ featureId: "f", assetId: "nope" }),
    ).toThrow(Arc3DError)
    catalog.registerAsset(asset("temp"))
    catalog.clear()
    expect(catalog.listAssets()).toEqual([])
    expect(catalog.listLayers()).toEqual([])
  })

  it("does not leave a partial asset when its schema conflicts", () => {
    const catalog = new DataCatalog()
    catalog.registerSchema({ id: "shared", fields: [] })
    expect(() =>
      catalog.registerAsset(
        asset("a", { schema: { id: "shared", fields: [] } }),
      ),
    ).toThrow(Arc3DError)
    expect(catalog.hasAsset("a")).toBe(false)
    expect(catalog.getAsset("a")).toBeUndefined()
  })

  it("isolates internal state from mutations of registered inputs", () => {
    const catalog = new DataCatalog()
    const input = asset("iso", {
      schema: { id: "iso-s", fields: [{ name: "n", type: "number" }] },
    })
    catalog.registerAsset(input)
    input.uri = "https://changed"
    input.schema?.fields.push({ name: "extra", type: "string" })
    expect(catalog.getAsset("iso")?.uri).toBe("https://data/iso.geojson")
    expect(catalog.getAsset("iso")?.schema?.fields).toHaveLength(1)
  })

  it("isolates internal state from mutations of returned snapshots", () => {
    const catalog = new DataCatalog()
    catalog.registerAsset(asset("snap"))
    const fetched = catalog.getAsset("snap")
    expect(fetched).toBeDefined()
    fetched!.uri = "https://mutated"
    catalog.listAssets()[0].uri = "https://also-mutated"
    expect(catalog.getAsset("snap")?.uri).toBe("https://data/snap.geojson")
  })

  it("stores an independent copy when registering a layer", () => {
    const catalog = new DataCatalog()
    const meta: LayerMetadata = {
      id: "l",
      kind: "imagery",
      visible: true,
      loadState: "idle",
    }
    catalog.registerLayer(meta)
    meta.loadState = "failed"
    expect(catalog.getLayer("l")?.loadState).toBe("idle")
  })

  it("removes an asset-owned schema when the asset is unregistered", () => {
    const catalog = new DataCatalog()
    catalog.registerAsset(
      asset("owned", { schema: { id: "owned-s", fields: [] } }),
    )
    expect(catalog.hasSchema("owned-s")).toBe(true)

    expect(catalog.unregisterAsset("owned")).toBe(true)
    expect(catalog.hasSchema("owned-s")).toBe(false)

    // 相同 ID 的资产与 schema 可以重新注册。
    expect(() =>
      catalog.registerAsset(
        asset("owned", { schema: { id: "owned-s", fields: [] } }),
      ),
    ).not.toThrow()
    expect(catalog.getAsset("owned")?.schema?.id).toBe("owned-s")
  })

  it("manages standalone schemas independently of assets", () => {
    const catalog = new DataCatalog()
    catalog.registerSchema({ id: "standalone", fields: [] })
    catalog.registerAsset(asset("plain"))

    expect(catalog.hasSchema("standalone")).toBe(true)
    expect(catalog.unregisterSchema("standalone")).toBe(true)
    expect(catalog.hasSchema("standalone")).toBe(false)
    expect(catalog.unregisterSchema("standalone")).toBe(false)
  })

  it("refuses to unregister a schema still owned by a live asset", () => {
    const catalog = new DataCatalog()
    catalog.registerAsset(
      asset("owner", { schema: { id: "owner-s", fields: [] } }),
    )
    expect(() => catalog.unregisterSchema("owner-s")).toThrow(Arc3DError)
    expect(catalog.hasSchema("owner-s")).toBe(true)
  })
})
