import { describe, expect, it } from "vitest"
import {
  isScreenEventName,
  listScreenEventNames,
} from "../../packages/interaction/src/event-names"

describe("screen event names", () => {
  it("lists the supported event names", () => {
    const names = listScreenEventNames()
    expect(names).toContain("leftClick")
    expect(names).toContain("mouseMove")
    expect(names).toContain("wheel")
    expect(names.length).toBe(15)
  })

  it("recognizes valid names only", () => {
    expect(isScreenEventName("rightClick")).toBe(true)
    expect(isScreenEventName("hover")).toBe(false)
    expect(isScreenEventName("")).toBe(false)
  })
})
