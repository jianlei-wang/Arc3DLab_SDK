import { describe, expect, it } from "vitest"
import { Arc3DError, DataCatalog, type DataAsset } from "@arc3dlab/core"

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
})
