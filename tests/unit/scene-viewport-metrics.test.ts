import { describe, expect, it } from "vitest"
import {
  DEFAULT_VERTICAL_FOV,
  extentFromCenter,
  metersPerPixelAtHeight,
} from "../../packages/scene/src/viewport-metrics"

describe("metersPerPixelAtHeight", () => {
  it("shrinks as the camera descends", () => {
    const high = metersPerPixelAtHeight(10000, 800, DEFAULT_VERTICAL_FOV)
    const low = metersPerPixelAtHeight(1000, 800, DEFAULT_VERTICAL_FOV)
    expect(high).toBeGreaterThan(low)
    expect(low).toBeGreaterThan(0)
  })

  it("returns zero for degenerate inputs", () => {
    expect(metersPerPixelAtHeight(0, 800)).toBe(0)
    expect(metersPerPixelAtHeight(1000, 0)).toBe(0)
  })
})

describe("extentFromCenter", () => {
  it("orders the extent around the centre", () => {
    const extent = extentFromCenter({ longitude: 0, latitude: 0 }, 10000, 10000)
    expect(extent[0]).toBeLessThan(0)
    expect(extent[2]).toBeGreaterThan(0)
    expect(extent[1]).toBeLessThan(0)
    expect(extent[3]).toBeGreaterThan(0)
  })
})
