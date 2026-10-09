import { describe, expect, it } from "vitest"
import { HoverGate, pickIdentity } from "../../packages/interaction/src/pick"

describe("HoverGate", () => {
  it("emits only when the hit identity changes", () => {
    const gate = new HoverGate()
    expect(gate.observe(pickIdentity({ graphicId: "g-1" }))).toBe(true)
    expect(gate.observe(pickIdentity({ graphicId: "g-1" }))).toBe(false)
    expect(gate.observe(pickIdentity({ graphicId: "g-2" }))).toBe(true)
    expect(gate.observe(pickIdentity({ layerId: "layer-1" }))).toBe(true)
    expect(gate.observe(pickIdentity({ kind: "empty" }))).toBe(true)
    expect(gate.observe("empty")).toBe(false)
  })

  it("emits a leave only when leaving a real hit", () => {
    const gate = new HoverGate()
    expect(gate.leave()).toBe(false)
    gate.observe("graphic:g-1")
    expect(gate.leave()).toBe(true)
    expect(gate.leave()).toBe(false)
  })
})
