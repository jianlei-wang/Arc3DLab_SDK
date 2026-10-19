import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  parseIntegrity,
  verifyInstalledManifest,
  verifyIntegrity,
  verifyRegistryMetadata,
  verifyTarballEntries,
} from "../../scripts/verify-registry.mjs"

const content = Buffer.from("arc3dlab")
const integrity = `sha512-${createHash("sha512").update(content).digest("base64")}`

describe("registry verification", () => {
  it("validates SRI integrity", () => {
    expect(parseIntegrity(integrity)).toBeTruthy()
    expect(parseIntegrity("not-integrity")).toBeUndefined()
    expect(verifyIntegrity(content, integrity)).toBe(true)
    expect(verifyIntegrity(Buffer.from("other"), integrity)).toBe(false)
  })

  it("validates registry metadata", () => {
    expect(
      verifyRegistryMetadata(
        {
          name: "arc3dlab",
          version: "2.0.0",
          dist: {
            tarball: "https://registry.npmjs.org/arc3dlab/-/arc3dlab-2.0.0.tgz",
            integrity,
          },
        },
        "2.0.0",
      ),
    ).toEqual([])
    expect(
      verifyRegistryMetadata(
        { name: "other", version: "2.0.1", dist: { tarball: "http://x" } },
        "2.0.0",
      ).length,
    ).toBe(4)
  })

  it("checks the published tarball against the local artifact list", () => {
    const entries = [
      "package/",
      "package/package.json",
      "package/README.md",
      "package/LICENSE",
      "package/dist/arc3dlab.esm.js",
      "package/dist/index.d.ts",
      "package/dist/assets/worker.js",
    ]
    expect(
      verifyTarballEntries(
        entries,
        ["dist/arc3dlab.esm.js", "dist/index.d.ts", "dist/assets/worker.js"],
        ["dist", "README.md", "LICENSE"],
      ),
    ).toEqual([])

    const issues = verifyTarballEntries(
      [
        ...entries,
        "package/dist/arc3dlab.esm.js.map",
        "package/node_modules/private/index.js",
        "package/dist/extra.js",
      ],
      ["dist/arc3dlab.esm.js", "dist/index.d.ts", "dist/assets/worker.js"],
      ["dist", "README.md", "LICENSE"],
    ).join("\n")
    expect(issues).toContain("source map")
    expect(issues).toContain("must not publish node_modules/")
    expect(issues).toContain("unexpected dist artifact")
  })

  it("checks the installed package contract", () => {
    const pkg = {
      name: "arc3dlab",
      version: "2.0.0",
      type: "module",
      peerDependencies: { cesium: "1.146.0" },
    }
    expect(verifyInstalledManifest(pkg, "2.0.0")).toEqual([])
    const issues = verifyInstalledManifest(
      {
        name: "other",
        version: "2.0.1",
        type: "commonjs",
        main: "index.js",
        dependencies: { x: "1" },
        peerDependencies: { cesium: "^1.146.0" },
      },
      "2.0.0",
    ).join("\n")
    expect(issues).toContain("name")
    expect(issues).toContain("version")
    expect(issues).toContain("ESM-only")
    expect(issues).toContain("must not declare main")
    expect(issues).toContain("runtime dependencies")
    expect(issues).toContain("exact cesium peer")
  })
})
