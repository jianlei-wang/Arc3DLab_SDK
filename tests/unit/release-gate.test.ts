import { describe, expect, it } from "vitest"
import {
  checkDependencyBoundaries,
  checkLicense,
  checkPublicExports,
  PUBLIC_EXPORT_NAMES,
} from "../../scripts/release-gate.mjs"

describe("release gates", () => {
  it("keeps package dependency boundaries", () => {
    expect(checkDependencyBoundaries()).toEqual([])
  })

  it("exposes the public SDK export surface", () => {
    expect(checkPublicExports()).toEqual([])
    expect(PUBLIC_EXPORT_NAMES).toEqual([
      "Arc3D",
      "Arc3DApp",
      "Arc3DError",
      "CesiumEngine",
      "createId",
      "Viewer",
    ])
  })

  it("keeps license, NOTICE, and Cesium peer consistent", () => {
    expect(checkLicense()).toEqual([])
  })
})
