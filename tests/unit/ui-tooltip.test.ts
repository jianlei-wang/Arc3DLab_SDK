import { describe, expect, it } from "vitest"
import {
  TOOLTIP_OWNED_ATTR,
  hostRelativePosition,
  removeOwnedTooltip,
  tooltipOffsetStyle,
} from "../../packages/ui/src/tooltip-dom"

describe("tooltip positioning", () => {
  it("places the tooltip relative to the host box", () => {
    expect(hostRelativePosition(140, 90, { left: 40, top: 20 })).toEqual({ x: 100, y: 70 })
    expect(tooltipOffsetStyle({ x: 100, y: 70 })).toEqual({ left: "115px", top: "90px" })
  })
})

describe("tooltip ownership", () => {
  it("removes only SDK-owned nodes", () => {
    const removed: string[] = []
    const owned = {
      getAttribute(name: string) {
        return name === TOOLTIP_OWNED_ATTR ? "true" : null
      },
      remove() {
        removed.push("owned")
      },
    }
    const external = {
      getAttribute() {
        return null
      },
      remove() {
        removed.push("external")
      },
    }
    expect(removeOwnedTooltip(owned)).toBe(true)
    expect(removeOwnedTooltip(external)).toBe(false)
    expect(removed).toEqual(["owned"])
  })
})
