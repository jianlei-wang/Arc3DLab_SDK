import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { ClipAnalysis } from "@arc3dlab/analysis"

function clip() {
  const globe = {
    clippingPlanes: { enabled: false, removeAll() {}, destroy() {} },
    clippingPolygons: { enabled: false, removeAll() {} },
  }
  const analysis = new ClipAnalysis({
    lifecycle: new LifecycleManager(),
    engine: {
      native: {
        viewer: {
          scene: { globe },
        },
      },
    },
  } as Arc3DContext)
  return { analysis, globe }
}

describe("ClipAnalysis", () => {
  it("records a plane clip", () => {
    const { analysis, globe } = clip()
    analysis.setPlane({ origin: [120, 30, 0], heading: 90 })
    expect(analysis.list()).toEqual(["plane"])
    expect(globe.clippingPlanes.enabled).toBe(true)
  })

  it("records a polygon clip and clears all", () => {
    const { analysis } = clip()
    analysis.setPolygon({
      positions: [
        [120, 30],
        [120.1, 30],
        [120.1, 30.1],
      ],
    })
    expect(analysis.list()).toEqual(["polygon"])
    analysis.clear()
    expect(analysis.list()).toEqual([])
  })

  it("records excavation with polygon and floor plane", () => {
    const { analysis, globe } = clip()
    analysis.setExcavation({
      positions: [
        [120, 30],
        [120.1, 30],
        [120.1, 30.1],
        [120, 30.1],
      ],
      depth: 20,
    })
    expect(analysis.list()).toEqual(["excavation"])
    expect(globe.clippingPlanes.enabled).toBe(true)
    expect(globe.clippingPolygons.enabled).toBe(true)
  })
})
