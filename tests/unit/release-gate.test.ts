import { describe, expect, it } from "vitest"
import {
  checkDependencyBoundaries,
  checkLicense,
  checkPublicExports,
  checkWorkspaceAliases,
  collectPublicExports,
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

  it("resolves the real export table via the TypeScript compiler", () => {
    const exports = collectPublicExports()
    expect(exports.values).toContain("Arc3D")
    expect(exports.values).toContain("createId")
    expect(exports.types).toContain("Arc3DConfig")
    expect(exports.types).toContain("SpatialReference")
    // runtime values must never be classified as type-only
    expect(exports.types).not.toContain("Arc3D")
  })

  it("keeps package aliases and tsconfig paths in sync", () => {
    expect(checkWorkspaceAliases()).toEqual([])
  })

  it("keeps license, NOTICE, and Cesium peer consistent", () => {
    expect(checkLicense()).toEqual([])
  })
})
