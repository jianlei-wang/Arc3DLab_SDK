import { describe, expect, it } from "vitest"
import {
  assessApiChanges,
  diffApiSurfaces,
  validateStabilityPolicy,
} from "../../scripts/api-stability.mjs"

function makeManifest(overrides: Record<string, unknown> = {}) {
  const entry = {
    values: ["Arc3D", "Old"],
    types: ["Arc3DConfig"],
    signatures: {
      Arc3D: "create(config: Arc3DConfig): Promise<Arc3DApp>",
      Arc3DConfig: "interface Arc3DConfig { container: string }",
      Old: "old(): void",
    },
    deprecated: {},
    ...overrides,
  }
  return {
    version: "2.0.0",
    values: entry.values,
    types: entry.types,
    deprecated: entry.deprecated,
    entries: { ".": entry },
  }
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    entries: {
      ".": {
        stable: ["Arc3D", "Arc3DConfig", "Old"],
        experimental: [],
        internal: [],
        deprecated: {},
        deprecatedMembers: {},
        ...overrides,
      },
    },
  }
}

describe("public API stability policy", () => {
  it("accepts a policy covering every public export exactly once", () => {
    expect(validateStabilityPolicy(makePolicy(), makeManifest())).toEqual([])
  })

  it("rejects missing, unknown, and overlapping classifications", () => {
    const missing = validateStabilityPolicy(
      makePolicy({ stable: ["Arc3D", "Arc3DConfig"] }),
      makeManifest(),
    )
    expect(missing.join("\n")).toContain("missing classification for Old")

    const unknown = validateStabilityPolicy(
      makePolicy({ stable: ["Arc3D", "Arc3DConfig", "Old", "Ghost"] }),
      makeManifest(),
    )
    expect(unknown.join("\n")).toContain("unknown export Ghost")

    const overlap = validateStabilityPolicy(
      makePolicy({ internal: ["Old"] }),
      makeManifest(),
    )
    expect(overlap.join("\n")).toContain(
      "classified as both stable and internal",
    )
  })

  it("validates deprecation metadata and manifest annotations", () => {
    const policy = makePolicy({
      stable: ["Arc3D", "Arc3DConfig"],
      deprecated: {
        Old: {
          stability: "stable",
          since: "2.0.0",
          removeIn: "3.0.0",
          replacement: "Arc3D",
          reason: "旧入口",
        },
      },
    })
    const manifest = makeManifest({ deprecated: { Old: "旧入口" } })
    expect(validateStabilityPolicy(policy, manifest)).toEqual([])

    const badBoundary = validateStabilityPolicy(
      makePolicy({
        stable: ["Arc3D", "Arc3DConfig"],
        deprecated: {
          Old: {
            stability: "stable",
            since: "2.0.0",
            removeIn: "2.5.0",
            replacement: "Arc3D",
            reason: "旧入口",
          },
        },
      }),
      manifest,
    )
    expect(badBoundary.join("\n")).toContain("cross a major boundary")

    const missingAnnotation = validateStabilityPolicy(policy, makeManifest())
    expect(missingAnnotation.join("\n")).toContain("missing deprecation Old")
  })
})

describe("public API compatibility review", () => {
  const policy = makePolicy()
  const base = makeManifest()

  it("requires a major bump for stable removals and signature changes", () => {
    const removed = {
      ...base,
      entries: {
        ".": {
          ...base.entries["."],
          values: ["Arc3D"],
          types: ["Arc3DConfig"],
          signatures: {
            Arc3D: base.entries["."].signatures.Arc3D,
            Arc3DConfig: base.entries["."].signatures.Arc3DConfig,
          },
        },
      },
    }
    const changes = diffApiSurfaces(base, removed, policy)
    const issues = assessApiChanges(changes, {
      baseVersion: "2.0.0",
      version: "2.0.0",
      policy,
    })
    expect(issues.join("\n")).toContain("requires a major version bump")
    expect(
      assessApiChanges(changes, {
        baseVersion: "2.0.0",
        version: "3.0.0",
        policy,
      }),
    ).toEqual([])
  })

  it("requires a minor bump for public additions", () => {
    const added = {
      ...base,
      values: [...base.values, "NewApi"],
      entries: {
        ".": {
          ...base.entries["."],
          values: [...base.entries["."].values, "NewApi"],
          signatures: {
            ...base.entries["."].signatures,
            NewApi: "newApi(): void",
          },
        },
      },
    }
    const addedPolicy = makePolicy({
      stable: ["Arc3D", "Arc3DConfig", "Old", "NewApi"],
    })
    const changes = diffApiSurfaces(base, added, addedPolicy)
    expect(
      assessApiChanges(changes, {
        baseVersion: "2.0.0",
        version: "2.0.0",
        policy: addedPolicy,
      }).join("\n"),
    ).toContain("requires a minor version bump")
    expect(
      assessApiChanges(changes, {
        baseVersion: "2.0.0",
        version: "2.1.0",
        policy: addedPolicy,
      }),
    ).toEqual([])
  })

  it("allows internal changes in patches and gates experimental changes at minor", () => {
    const internalPolicy = makePolicy({
      stable: ["Arc3D", "Arc3DConfig"],
      internal: ["Old"],
    })
    const current = makeManifest({
      values: ["Arc3D"],
      deprecated: {},
      signatures: {
        Arc3D: base.entries["."].signatures.Arc3D,
        Arc3DConfig: base.entries["."].signatures.Arc3DConfig,
      },
    })
    const changes = diffApiSurfaces(base, current, internalPolicy)
    expect(
      assessApiChanges(changes, {
        baseVersion: "2.0.0",
        version: "2.0.1",
        policy: internalPolicy,
      }),
    ).toEqual([])

    const experimentalPolicy = makePolicy({
      stable: ["Arc3D", "Arc3DConfig"],
      experimental: ["Old"],
    })
    const experimentalChanges = diffApiSurfaces(
      base,
      current,
      experimentalPolicy,
    )
    expect(
      assessApiChanges(experimentalChanges, {
        baseVersion: "2.0.0",
        version: "2.0.1",
        policy: experimentalPolicy,
      }).join("\n"),
    ).toContain("requires a minor version bump")
  })

  it("prevents deprecated APIs from changing before removeIn", () => {
    const deprecatedPolicy = makePolicy({
      stable: ["Arc3D", "Arc3DConfig"],
      deprecated: {
        Old: {
          stability: "stable",
          since: "2.0.0",
          removeIn: "3.0.0",
          replacement: "Arc3D",
          reason: "旧入口",
        },
      },
    })
    const current = makeManifest({
      values: ["Arc3D"],
      deprecated: {},
      signatures: {
        Arc3D: base.entries["."].signatures.Arc3D,
        Arc3DConfig: base.entries["."].signatures.Arc3DConfig,
      },
    })
    const changes = diffApiSurfaces(base, current, deprecatedPolicy)
    expect(
      assessApiChanges(changes, {
        baseVersion: "2.0.0",
        version: "3.0.0",
        policy: deprecatedPolicy,
      }),
    ).toEqual([])
    expect(
      assessApiChanges(changes, {
        baseVersion: "2.0.0",
        version: "2.1.0",
        policy: deprecatedPolicy,
      }).join("\n"),
    ).toContain("cannot change before removeIn 3.0.0")
  })
})
