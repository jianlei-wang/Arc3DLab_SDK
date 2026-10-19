import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { collectPublishArtifacts } from "../../scripts/publish-manifest.mjs"

const roots: string[] = []

function createDist(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "arc3dlab-manifest-"))
  roots.push(root)
  for (const path of files) {
    const target = join(root, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, "// fixture\n")
  }
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe("publish manifest", () => {
  it("excludes source maps and internal declaration directories", () => {
    const root = createDist([
      "dist/arc3dlab.esm.js",
      "dist/arc3dlab.esm.js.map",
      "dist/index.d.ts",
      "dist/engine-cesium.d.ts",
      "dist/engine-cesium.js.map",
      "dist/globe.jpg",
      "dist/assets/analysis-worker-entry-a.js",
      "dist/assets/analysis-worker-entry-a.js.map",
      "dist/scene-mode-a.js",
      "dist/src/index.d.ts",
      "dist/packages/core/src/index.d.ts",
    ])

    expect(collectPublishArtifacts(root)).toEqual([
      "dist/arc3dlab.esm.js",
      "dist/assets/analysis-worker-entry-a.js",
      "dist/engine-cesium.d.ts",
      "dist/globe.jpg",
      "dist/index.d.ts",
      "dist/scene-mode-a.js",
    ])
  })

  it("fails when the build output is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "arc3dlab-manifest-"))
    roots.push(root)
    expect(() => collectPublishArtifacts(root)).toThrow(/Missing dist/)
  })
})
