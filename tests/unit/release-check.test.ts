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
    const issues = checkReleaseState(state, { tag: "v2.0.0" })
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
