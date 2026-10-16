import { describe, expect, it } from "vitest"
import { JulianDate } from "cesium"
import {
  DYNAMIC_SPREAD_MATERIAL,
  DynamicSpreadMaterialProperty,
  POLYLINE_TRAIL_MATERIAL,
  PolylineTrailMaterialProperty,
  registerArc3DMaterials,
} from "@arc3dlab/effects"

const epoch = JulianDate.fromIso8601("2024-01-01T00:00:00Z")

describe("DynamicSpreadMaterialProperty", () => {
  it("reports its material type and non-constant nature", () => {
    const property = new DynamicSpreadMaterialProperty()
    expect(property.getType()).toBe(DYNAMIC_SPREAD_MATERIAL)
    expect(property.isConstant).toBe(false)
  })

  it("produces animated material values", () => {
    const property = new DynamicSpreadMaterialProperty({ gradient: 6 })
    const first = property.getValue(epoch)
    expect(first.gradient).toBe(6)
    expect(first.time).toBe(0)
    const later = property.getValue(
      JulianDate.addSeconds(epoch, 1, new JulianDate()),
    )
    expect(later.time).toBeCloseTo(1, 5)
  })

  it("keeps elapsed time monotonic across midnight", () => {
    const property = new DynamicSpreadMaterialProperty()
    const before = JulianDate.fromIso8601("2024-01-01T23:59:59Z")
    expect(property.getValue(before).time).toBe(0)
    const after = JulianDate.addSeconds(before, 2, new JulianDate())
    const value = property.getValue(after)
    expect(value.time).toBeCloseTo(2, 5)
    expect(value.time).toBeGreaterThan(0)
  })

  it("locks the epoch to a snapshot of the first time", () => {
    const property = new DynamicSpreadMaterialProperty()
    const time = JulianDate.fromIso8601("2024-01-01T00:00:00Z")
    property.getValue(time)
    JulianDate.addSeconds(time, 3600, time)
    expect(property.getValue(time).time).toBeCloseTo(3600, 3)
  })

  it("compares by color and gradient", () => {
    const a = new DynamicSpreadMaterialProperty({ color: "#ff0000" })
    const b = new DynamicSpreadMaterialProperty({ color: "#ff0000" })
    const c = new DynamicSpreadMaterialProperty({ color: "#00ff00" })
    expect(a.equals(b)).toBe(true)
    expect(a.equals(c)).toBe(false)
  })

  it("treats a different duration as unequal", () => {
    const a = new DynamicSpreadMaterialProperty({ duration: 500 })
    const b = new DynamicSpreadMaterialProperty({ duration: 500 })
    const c = new DynamicSpreadMaterialProperty({ duration: 800 })
    expect(a.equals(b)).toBe(true)
    expect(a.equals(c)).toBe(false)
  })
})

describe("PolylineTrailMaterialProperty", () => {
  it("reports its material type", () => {
    expect(new PolylineTrailMaterialProperty().getType()).toBe(
      POLYLINE_TRAIL_MATERIAL,
    )
  })

  it("carries the flow image and compares by image", () => {
    const a = new PolylineTrailMaterialProperty({ image: "texture.png" })
    const b = new PolylineTrailMaterialProperty({ image: "texture.png" })
    expect(a.getValue(epoch).image).toBe("texture.png")
    expect(a.equals(b)).toBe(true)
  })

  it("keeps elapsed time monotonic across midnight", () => {
    const property = new PolylineTrailMaterialProperty()
    const before = JulianDate.fromIso8601("2024-01-01T23:59:59Z")
    expect(property.getValue(before).time).toBe(0)
    const value = property.getValue(
      JulianDate.addSeconds(before, 2, new JulianDate()),
    )
    expect(value.time).toBeCloseTo(2, 5)
    expect(value.time).toBeGreaterThan(0)
  })

  it("treats a different duration as unequal", () => {
    const a = new PolylineTrailMaterialProperty({ duration: 500 })
    const b = new PolylineTrailMaterialProperty({ duration: 500 })
    const c = new PolylineTrailMaterialProperty({ duration: 800 })
    expect(a.equals(b)).toBe(true)
    expect(a.equals(c)).toBe(false)
  })
})

describe("registerArc3DMaterials", () => {
  it("is idempotent", () => {
    expect(() => {
      registerArc3DMaterials()
      registerArc3DMaterials()
    }).not.toThrow()
  })
})
