import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  EventBus,
  LifecycleManager,
  ResourceRegistry,
  createHandle,
  createId,
} from "@arc3dlab/core"

describe("createId", () => {
  it("returns unique values", () => {
    expect(createId()).not.toEqual(createId())
  })
})

describe("LifecycleManager", () => {
  it("blocks API use after destroy", () => {
    const life = new LifecycleManager()
    life.transition("destroyed")
    expect(() => life.assertUsable("add layer")).toThrow(Arc3DError)
  })
})

describe("EventBus", () => {
  it("unsubscribes with the returned function", () => {
    const bus = new EventBus<{ ping: { n: number } }>()
    const received: number[] = []
    const off = bus.on("ping", (payload) => received.push(payload.n))
    bus.emit("ping", { n: 1 })
    off()
    bus.emit("ping", { n: 2 })
    expect(received).toEqual([1])
  })
})

describe("ResourceRegistry", () => {
  it("destroys owned resources on remove", () => {
    const registry = new ResourceRegistry()
    let destroyed = false
    const handle = createHandle({
      id: "poly-1",
      type: "polygon",
      native: { fill: true, outline: true },
      onDestroy: () => {
        destroyed = true
      },
    })
    registry.add(handle)
    expect(registry.remove("poly-1")).toBe(true)
    expect(destroyed).toBe(true)
    expect(registry.get("poly-1")).toBeUndefined()
  })

  it("rejects duplicate ids", () => {
    const registry = new ResourceRegistry()
    const handle = createHandle({ id: "a", type: "point", native: {} })
    registry.add(handle)
    expect(() => registry.add(createHandle({ id: "a", type: "point", native: {} }))).toThrow(
      Arc3DError
    )
  })

  it("binds visible through the handle setter", () => {
    const shown: boolean[] = []
    const handle = createHandle({
      id: "layer-1",
      type: "imagery",
      native: {},
      onVisible: (visible) => {
        shown.push(visible)
      },
    })
    handle.visible = false
    handle.visible = true
    expect(handle.visible).toBe(true)
    expect(shown).toEqual([false, true])
  })
})
