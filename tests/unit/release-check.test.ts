import { describe, expect, it } from "vitest"
import {
  checkReleaseState,
  collectReleaseState,
  findVersionSection,
  hasBreakingChanges,
  parseReleaseVersion,
} from "../../scripts/release-check.mjs"

const state = collectReleaseState()

function withoutUnreleased(changes: string) {
  return changes.replace(/^## Unreleased\s*$[\s\S]*?(?=^## )/m, "")
}

function stateFor(version: string, body: string) {
  const packageJson = JSON.parse(state.packageJson)
  packageJson.version = version
  const packageLock = JSON.parse(state.packageLock)
  packageLock.version = version
  packageLock.packages[""].version = version
  return {
    ...state,
    packageJson: JSON.stringify(packageJson),
    packageLock: JSON.stringify(packageLock),
    changes: `# Change Log\n\n## Unreleased\n\n## v${version} - 2026-10-19\n${body}\n\n## v2.0.0 - 2026-10-12\n\n### Breaking Changes\n\n- removed\n\n### Known Limitations\n\n- none\n`,
    compatibility: `${state.compatibility}\n| ${version.split(".").slice(0, 2).join(".")}.x | 1.146.0 | >=22 | Active |\n`,
    apiSnapshot: undefined,
  }
}

describe("release metadata check", () => {
  it("accepts release metadata with an empty Unreleased section", () => {
    expect(
      checkReleaseState(
        { ...state, changes: withoutUnreleased(state.changes) },
        { tag: "v2.0.0" },
      ),
    ).toEqual([])
  })

  it("rejects tagging while Unreleased entries remain", () => {
    const changes = stateFor(
      "2.0.0",
      "### Known Limitations\n\n- none",
    ).changes.replace(
      "## Unreleased\n",
      "## Unreleased\n\n### feat\n\n- pending\n",
    )
    const issues = checkReleaseState({ ...state, changes }, { tag: "v2.0.0" })
    expect(issues).toContain(
      "CHANGES.md Unreleased entries must be moved into v2.0.0 before tagging v2.0.0",
    )
  })

  it("rejects a release tag that does not match package.json", () => {
    const issues = checkReleaseState(
      { ...state, changes: withoutUnreleased(state.changes) },
      { tag: "v2.0.1" },
    )
    expect(issues).toContain(
      "release tag mismatch: expected v2.0.0, received v2.0.1",
    )
  })

  it("rejects a missing released changelog section", () => {
    const issues = checkReleaseState({
      ...state,
      changes: "# Change Log\n\n## Unreleased\n\n### feat\n\n- pending\n",
    })
    expect(issues).toContain("CHANGES.md missing released section for v2.0.0")
  })

  it("requires migration notes for breaking releases", () => {
    const issues = checkReleaseState({ ...state, migrationDocs: [] })
    expect(
      issues.some((issue) => issue.includes("require migration notes")),
    ).toBe(true)
  })

  it("requires the active compatibility matrix row", () => {
    const issues = checkReleaseState({
      ...state,
      compatibility: "# Compatibility\n",
    })
    expect(issues).toContain("COMPATIBILITY.md missing active matrix row 2.0.x")
  })

  it("requires package-lock.json to match the package version", () => {
    const lock = JSON.parse(state.packageLock)
    lock.version = "2.0.1"
    lock.packages[""].version = "2.0.1"
    const issues = checkReleaseState({
      ...state,
      packageLock: JSON.stringify(lock),
    })
    expect(issues.some((issue) => issue.includes("package-lock.json"))).toBe(
      true,
    )
  })

  it("requires known limitations in every released section", () => {
    const issues = checkReleaseState(stateFor("2.1.0", "### feat\n\n- new API"))
    expect(issues).toContain(
      'CHANGES.md section for v2.1.0 must include a "### Known Limitations" section',
    )
  })

  it("allows features in a minor release and rejects them in a patch", () => {
    const body = "### feat\n\n- new API\n\n### Known Limitations\n\n- none"
    expect(checkReleaseState(stateFor("2.1.0", body))).toEqual([])
    const issues = checkReleaseState(stateFor("2.0.1", body))
    expect(issues.join("\n")).toContain(
      "require a minor or major bump from v2.0.0",
    )
  })

  it("rejects breaking changes in a minor release", () => {
    const body =
      "### Breaking Changes\n\n- removed\n\n### Known Limitations\n\n- none"
    const issues = checkReleaseState(stateFor("2.1.0", body))
    expect(issues.join("\n")).toContain("require a major bump from v2.0.0")
  })

  it("requires a release snapshot when tagging", () => {
    const issues = checkReleaseState(
      {
        ...state,
        changes: withoutUnreleased(state.changes),
        apiSnapshot: undefined,
      },
      { tag: "v2.0.0" },
    )
    expect(issues).toContain(
      "missing API snapshot scripts/api-history/v2.0.0.json; run npm run api:snapshot",
    )
  })

  it("requires deprecated entries to be logged for the release", () => {
    const policy = JSON.parse(state.stabilityPolicy ?? "{}")
    policy.schemaVersion = 1
    policy.entries = {
      ".": {
        deprecated: {
          Old: {
            stability: "stable",
            since: "2.0.0",
            removeIn: "3.0.0",
            replacement: "New",
            reason: "legacy",
          },
        },
      },
    }
    const issues = checkReleaseState({
      ...state,
      stabilityPolicy: JSON.stringify(policy),
    })
    expect(issues.join("\n")).toContain('must include "### Deprecated"')
  })

  it("parses semver and finds version sections", () => {
    expect(parseReleaseVersion("2.1.0-alpha.1")).toEqual({
      major: 2,
      minor: 1,
      patch: 0,
    })
    expect(parseReleaseVersion("v2.0.0")).toBeUndefined()
    const section = findVersionSection(state.changes, "2.0.0")
    expect(section?.heading).toContain("v2.0.0")
    expect(hasBreakingChanges(section!)).toBe(true)
  })
})
