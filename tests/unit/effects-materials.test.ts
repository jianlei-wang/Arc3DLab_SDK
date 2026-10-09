import { describe, expect, it } from "vitest"
import { Arc3DError, LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { MaterialRegistry } from "@arc3dlab/effects"

function registry(): MaterialRegistry {
  return new MaterialRegistry({ lifecycle: new LifecycleManager() } as Arc3DContext)
}

describe("MaterialRegistry", () => {
  it("registers the built-in color material", () => {
    const materials = registry()
    expect(materials.has("color")).toBe(true)
    expect(materials.create("color", { color: "#00FFFF" })).toBe("#00FFFF")
  })

  it("creates a custom registered material", () => {
    const materials = registry()
    materials.register("flow-line", (options) => ({ type: "flow-line", ...options }))
    expect(materials.list()).toContain("flow-line")
    expect(materials.create("flow-line", { speed: 2 })).toEqual({ type: "flow-line", speed: 2 })
  })

  it("throws for an unknown material type", () => {
    expect(() => registry().create("missing")).toThrow(Arc3DError)
  })
})
