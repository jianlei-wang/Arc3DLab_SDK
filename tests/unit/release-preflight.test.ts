import { describe, expect, it } from "vitest"
import { checkReleaseTag } from "../../scripts/release-preflight.mjs"

describe("release preflight", () => {
  it("accepts a tag that matches the package version and HEAD", () => {
    expect(
      checkReleaseTag({
        version: "2.0.0",
        tag: "v2.0.0",
        headCommit: "abc123",
        tagCommit: "abc123",
      }),
    ).toEqual([])
  })

  it("rejects missing, mismatched and detached tags", () => {
    expect(
      checkReleaseTag({
        version: "2.0.0",
        tag: "v2.0.1",
        headCommit: "abc123",
        tagCommit: "abc123",
      }).join("\n"),
    ).toContain("must match package version")

    expect(
      checkReleaseTag({
        version: "2.0.0",
        tag: "v2.0.0",
        headCommit: "abc123",
        tagCommit: undefined,
      }).join("\n"),
    ).toContain("does not exist locally")

    expect(
      checkReleaseTag({
        version: "2.0.0",
        tag: "v2.0.0",
        headCommit: "abc123",
        tagCommit: "def456",
      }).join("\n"),
    ).toContain("points to def456")
  })
})
