import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  checkDependencyBoundaries,
  checkLicense,
  checkWorkspaceAliases,
  diffManifest,
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

  it("treats export signature changes as gate failures", () => {
    const expected = {
      entries: {
        ".": {
          values: ["Arc3D"],
          types: ["Arc3DConfig"],
          signatures: {
            Arc3D: "create(config: Arc3DConfig): Promise<Arc3DApp>",
            Arc3DConfig: "interface Arc3DConfig { container: string }",
          },
        },
      },
    }
    const actual = {
      ".": {
        values: ["Arc3D"],
        types: ["Arc3DConfig"],
        signatures: {
          Arc3D:
            "create(config: Arc3DConfig, extra: boolean): Promise<Arc3DApp>",
          Arc3DConfig: "interface Arc3DConfig { container: string }",
        },
      },
    }
    const issues = diffManifest(actual, expected)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain("signature changed")
    expect(issues[0]).toContain("Arc3D")
  })

  it("treats added or removed signatures as gate failures", () => {
    const base = {
      values: ["a"],
      types: [],
      signatures: { a: "(): void" },
    }
    const expected = { entries: { ".": base } }
    const added = diffManifest(
      { ".": { ...base, signatures: { a: "(): void", b: "(): void" } } },
      expected,
    )
    expect(added.some((issue) => issue.includes("signature added"))).toBe(true)
    const removed = diffManifest({ ".": { ...base, signatures: {} } }, expected)
    expect(removed.some((issue) => issue.includes("signature removed"))).toBe(
      true,
    )
  })

  it("treats removed public entries as gate failures", () => {
    const issues = diffManifest(
      {},
      {
        entries: {
          "./engine-cesium": { values: [], types: [], signatures: {} },
        },
      },
    )
    expect(issues.some((issue) => issue.includes("entry removed"))).toBe(true)
  })
})
