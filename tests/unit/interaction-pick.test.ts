import { describe, expect, it } from "vitest"
import {
  classifyPickedId,
  normalizeResourceId,
  parentResourceId,
} from "../../packages/interaction/src/pick"
import { pickIdentity, resolvePick } from "../../packages/interaction/src/pick"

describe("picking classification", () => {
  const resources = new Map([
    ["point-1", { id: "point-1", type: "point" }],
    ["line-1", { id: "line-1", type: "polyline" }],
    ["poly-1", { id: "poly-1", type: "polygon" }],
    ["model-1", { id: "model-1", type: "model" }],
    ["points-1", { id: "points-1", type: "point" }],
    ["layer-1", { id: "layer-1", type: "tileset" }],
    ["basemap-1", { id: "basemap-1", type: "basemap" }],
  ])
  const lookup = (id: string) => resources.get(id)

  it("classifies registered entity graphics", () => {
    expect(classifyPickedId("point-1", lookup)).toEqual({
      graphicId: "point-1",
    })
    expect(classifyPickedId("model-1", lookup)).toEqual({
      graphicId: "model-1",
    })
  })

  it("maps primitive child ids back to the parent graphic", () => {
    expect(parentResourceId("poly-1#fill")).toBe("poly-1")
    expect(classifyPickedId("poly-1#fill", lookup)).toEqual({
      graphicId: "poly-1",
    })
    expect(classifyPickedId("poly-1#outline", lookup)).toEqual({
      graphicId: "poly-1",
    })
    expect(classifyPickedId("points-1#0", lookup)).toEqual({
      graphicId: "points-1",
    })
    expect(classifyPickedId("model-1#node", lookup)).toEqual({
      graphicId: "model-1",
    })
  })

  it("classifies layers without writing graphicId", () => {
    expect(classifyPickedId("layer-1", lookup)).toEqual({ layerId: "layer-1" })
    expect(classifyPickedId("basemap-1", lookup)).toEqual({
      layerId: "basemap-1",
    })
  })

  it("leaves unknown native objects unclassified", () => {
    expect(classifyPickedId("cesium-orphan", lookup)).toEqual({})
    expect(classifyPickedId(undefined, lookup)).toEqual({})
  })

  it("classifies tiles features, terrain, and unregistered natives", () => {
    expect(
      resolvePick({
        lookup,
        tilesetId: "layer-1",
        hasNative: true,
      }),
    ).toEqual({ kind: "tiles-feature", layerId: "layer-1" })
    expect(
      resolvePick({
        lookup,
        tilesetId: "missing-tileset",
        hasNative: true,
      }),
    ).toEqual({ kind: "native" })
    expect(resolvePick({ lookup, isTerrain: true })).toEqual({
      kind: "terrain",
    })
    expect(
      resolvePick({ lookup, rawId: "cesium-orphan", hasNative: true }),
    ).toEqual({ kind: "native" })
    expect(resolvePick({ lookup })).toEqual({ kind: "empty" })
  })

  it("does not invent graphic ids for unknown objects", () => {
    expect(
      resolvePick({ lookup, rawId: "ghost#fill", hasNative: true }),
    ).toEqual({ kind: "native" })
    expect(pickIdentity({ graphicId: "point-1" })).toBe("graphic:point-1")
    expect(pickIdentity({ layerId: "layer-1" })).toBe("layer:layer-1")
    expect(pickIdentity({ kind: "terrain" })).toBe("terrain")
  })

  it("reads nested cesium entity ids", () => {
    expect(normalizeResourceId({ id: "line-1" })).toBe("line-1")
    expect(normalizeResourceId({ id: "poly-1#fill" })).toBe("poly-1#fill")
  })
})
