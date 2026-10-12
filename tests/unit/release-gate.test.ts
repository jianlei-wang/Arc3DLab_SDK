import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  checkDependencyBoundaries,
  checkLicense,
  checkWorkspaceAliases,
  PUBLIC_EXPORT_NAMES,
} from "../../scripts/release-gate.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(
  readFileSync(resolve(here, "../../scripts/public-api-manifest.json"), "utf8"),
) as { values: string[]; types: string[] }

describe("release gates", () => {
  it("keeps package dependency boundaries", () => {
    expect(checkDependencyBoundaries()).toEqual([])
  })

  it("exposes the curated public SDK export names", () => {
    expect(PUBLIC_EXPORT_NAMES).toEqual([
      "Arc3D",
      "Arc3DApp",
      "Arc3DError",
      "CesiumEngine",
      "createId",
      "Viewer",
    ])
  })

  it("keeps the public API manifest consistent with the SDK surface", () => {
    for (const name of PUBLIC_EXPORT_NAMES) {
      expect(manifest.values).toContain(name)
    }
    expect(manifest.types).toContain("Arc3DConfig")
    expect(manifest.types).toContain("SpatialReference")
    // runtime values must never be classified as type-only
    expect(manifest.types).not.toContain("Arc3D")
  })

  it("keeps package aliases and tsconfig paths in sync", () => {
    expect(checkWorkspaceAliases()).toEqual([])
  })

  it("keeps license, NOTICE, and Cesium peer consistent", () => {
    expect(checkLicense()).toEqual([])
  })
})
