import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  ResourceRegistry,
  assertGraphicStyle,
  assertNewResourceId,
  assertPositions,
  createHandle,
} from "@arc3dlab/core"
import { applyNativeStyle, assertMutableStyle } from "../../packages/graphics/src/style"
import {
  AUTO_PRIMITIVE_THRESHOLD,
  compareRenderBackends,
  decideRenderPolicy,
  graphicChildId,
  resolveRenderMode,
} from "../../packages/graphics/src/policy"

describe("resolveRenderMode", () => {
  it("keeps explicit entity and primitive modes", () => {
    expect(resolveRenderMode("entity", 100)).toBe("entity")
    expect(resolveRenderMode("primitive", 1)).toBe("primitive")
  })

  it("uses the count threshold for auto mode", () => {
    expect(resolveRenderMode("auto", 64)).toBe("entity")
    expect(resolveRenderMode(undefined, 65)).toBe("primitive")
  })

  it("rejects buffer until the backend exists", () => {
    expect(() => resolveRenderMode("buffer", 1)).toThrow(Arc3DError)
    try {
      resolveRenderMode("buffer", 1)
    } catch (error) {
      expect(error).toMatchObject({ code: "UNSUPPORTED_CAPABILITY" })
    }
  })
})

describe("decideRenderPolicy", () => {
  it("keeps explicit modes and reports them as explicit", () => {
    expect(decideRenderPolicy({ type: "polyline", count: 100, requestedMode: "entity" })).toEqual({
      mode: "entity",
      reason: "explicit-mode",
      editable: true,
    })
    expect(
      decideRenderPolicy({ type: "point", count: 1, dynamic: true, requestedMode: "primitive" })
    ).toEqual({
      mode: "primitive",
      reason: "explicit-mode",
      editable: false,
    })
  })

  it("prefers entity for dynamic editing and models", () => {
    expect(decideRenderPolicy({ type: "polygon", count: 80, dynamic: true })).toEqual({
      mode: "entity",
      reason: "dynamic-editing",
      editable: true,
    })
    expect(decideRenderPolicy({ type: "model", count: 1 })).toEqual({
      mode: "entity",
      reason: "model-entity-backend",
      editable: true,
    })
  })

  it("uses primitive for large auto batches", () => {
    expect(decideRenderPolicy({ type: "point", count: 65 })).toEqual({
      mode: "primitive",
      reason: "batch-count",
      editable: false,
    })
    expect(decideRenderPolicy({ type: "polyline", count: 64 })).toEqual({
      mode: "entity",
      reason: "small-count",
      editable: true,
    })
  })

  it("is stable for the same input", () => {
    const input = { type: "polygon" as const, count: 12, clampToGround: true }
    expect(decideRenderPolicy(input)).toEqual(decideRenderPolicy(input))
  })
})

describe("compareRenderBackends", () => {
  it("prefers primitive once the auto threshold is exceeded", () => {
    expect(AUTO_PRIMITIVE_THRESHOLD).toBe(64)
    expect(compareRenderBackends(64).prefer).toBe("entity")
    expect(compareRenderBackends(65).prefer).toBe("primitive")
  })
})

describe("graphic child ids", () => {
  it("builds pickable fill, outline, and point member ids", () => {
    expect(graphicChildId("poly-1", "fill")).toBe("poly-1#fill")
    expect(graphicChildId("poly-1", "outline")).toBe("poly-1#outline")
    expect(graphicChildId("points-1", 0)).toBe("points-1#0")
  })
})

describe("graphic parameter validation", () => {
  it("rejects empty and short position lists", () => {
    expect(() => assertPositions([], 1, "point")).toThrow(Arc3DError)
    expect(() => assertPositions([[120, 30]], 2, "polyline")).toThrow(Arc3DError)
    expect(() => assertPositions([[120, 30], [121, 31]], 3, "polygon")).toThrow(Arc3DError)
  })

  it("rejects illegal coordinates and non-finite values", () => {
    expect(() => assertPositions([[200, 30]], 1, "point")).toThrow(Arc3DError)
    expect(() => assertPositions([[120, 100]], 1, "point")).toThrow(Arc3DError)
    expect(() => assertPositions([[Number.NaN, 30]], 1, "point")).toThrow(Arc3DError)
  })

  it("rejects invalid colors and negative sizes", () => {
    expect(() => assertGraphicStyle({ color: "  " })).toThrow(Arc3DError)
    expect(() => assertGraphicStyle({ pixelSize: -1 })).toThrow(Arc3DError)
    expect(() => assertGraphicStyle({ width: Number.POSITIVE_INFINITY })).toThrow(Arc3DError)
  })
})

describe("resource id conflicts", () => {
  it("rejects duplicate ids before native create", () => {
    const registry = new ResourceRegistry()
    registry.add(createHandle({ id: "shared", type: "imagery", native: {} }))
    expect(() => assertNewResourceId(registry, "shared")).toThrow(Arc3DError)
    expect(registry.get("shared")?.type).toBe("imagery")
  })
})

describe("Graphic.setStyle", () => {
  it("updates entity point color and pixelSize", () => {
    const native = { point: { color: "red", outlineColor: "yellow", outlineWidth: 1, pixelSize: 10 } }
    applyNativeStyle(
      { id: "pt-1", type: "point", renderMode: "entity", native },
      { color: "#00ff00", pixelSize: 18 },
      { color: (css) => css, colorAttribute: (css) => css }
    )
    expect(native.point.color).toBe("#00ff00")
    expect(native.point.pixelSize).toBe(18)
  })

  it("updates entity polyline width and material", () => {
    const native = { polyline: { width: 2, material: "red" } }
    applyNativeStyle(
      { id: "line-1", type: "polyline", renderMode: "entity", native },
      { color: "#0000ff", width: 6 },
      { color: (css) => css, colorAttribute: (css) => css }
    )
    expect(native.polyline.material).toBe("#0000ff")
    expect(native.polyline.width).toBe(6)
  })

  it("updates entity polygon fill and outline", () => {
    const native = {
      polygon: { material: "red" },
      polyline: { width: 1, material: "green", show: true },
    }
    applyNativeStyle(
      { id: "poly-1", type: "polygon", renderMode: "entity", native },
      { fill: "#111111", outlineColor: "#222222", outlineWidth: 3 },
      { color: (css) => css, colorAttribute: (css) => css }
    )
    expect(native.polygon.material).toBe("#111111")
    expect(native.polyline.material).toBe("#222222")
    expect(native.polyline.width).toBe(3)
  })

  it("updates model color only", () => {
    const native = { model: { color: "white" } }
    applyNativeStyle(
      { id: "model-1", type: "model", renderMode: "entity", native },
      { color: "#abcdef" },
      { color: (css) => css, colorAttribute: (css) => css }
    )
    expect(native.model.color).toBe("#abcdef")
  })

  it("updates primitive point collection members", () => {
    const points = [
      { color: "red", outlineColor: "yellow", outlineWidth: 1, pixelSize: 8 },
      { color: "red", outlineColor: "yellow", outlineWidth: 1, pixelSize: 8 },
    ]
    const native = {
      length: points.length,
      get(index: number) {
        return points[index]
      },
    }
    applyNativeStyle(
      { id: "pts", type: "point", renderMode: "primitive", native },
      { color: "#00ffff", pixelSize: 14 },
      { color: (css) => css, colorAttribute: (css) => css }
    )
    expect(points[0]?.color).toBe("#00ffff")
    expect(points[1]?.pixelSize).toBe(14)
  })

  it("updates primitive polyline instance color", () => {
    const attrs = { color: "old" }
    const native = {
      getGeometryInstanceAttributes(id: string) {
        expect(id).toBe("line-p")
        return attrs
      },
    }
    applyNativeStyle(
      { id: "line-p", type: "polyline", renderMode: "primitive", native },
      { color: "#ff00ff" },
      { color: (css) => css, colorAttribute: (css) => `attr:${css}` }
    )
    expect(attrs.color).toBe("attr:#ff00ff")
  })

  it("rejects immutable primitive width changes", () => {
    expect(() =>
      assertMutableStyle("polyline", "primitive", { width: 2 }, { width: 8 })
    ).toThrow(Arc3DError)
  })

  it("rejects clampToGround changes after create", () => {
    expect(() =>
      assertMutableStyle("polygon", "entity", { clampToGround: true }, { clampToGround: false })
    ).toThrow(Arc3DError)
  })
})
