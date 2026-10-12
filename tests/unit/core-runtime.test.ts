import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  DisposerStack,
  EventBus,
  LifecycleManager,
  ResourceRegistry,
  ResourceTracker,
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
    life.transition("destroying")
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
    expect(() =>
      registry.add(createHandle({ id: "a", type: "point", native: {} })),
    ).toThrow(Arc3DError)
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

describe("ResourceRegistry.clear robustness", () => {
  it("keeps clearing remaining resources after one destroy throws", () => {
    const registry = new ResourceRegistry()
    const tracker = new ResourceTracker()
    const destroyed: string[] = []

    for (const id of ["a", "b", "c"]) {
      registry.add(
        createHandle({
          id,
          type: "polygon",
          native: {},
          onDestroy: () => {
            destroyed.push(id)
            if (id === "b") throw new Error("boom")
          },
        }),
      )
    }
    registry.add(
      createHandle({
        id: "parent",
        type: "group",
        native: {},
        onDestroy: () => {
          destroyed.push("parent")
        },
      }),
    )
    tracker.link("parent", "b")

    const errors: { id: string; message: string }[] = []
    const collected = registry.clear(tracker, (error, id) => {
      errors.push({
        id,
        message: error instanceof Error ? error.message : String(error),
      })
    })

    expect(destroyed).toContain("a")
    expect(destroyed).toContain("b")
    expect(destroyed).toContain("c")
    expect(destroyed).toContain("parent")
    expect(collected).toHaveLength(1)
    expect(errors).toEqual([{ id: "b", message: "boom" }])
    expect(registry.ids()).toEqual([])
    expect(tracker.size).toBe(0)
  })

  it("returns defensive copies from childrenOf and unlink", () => {
    const tracker = new ResourceTracker()
    tracker.link("parent", "child")
    const children = tracker.childrenOf("parent")
    children.push("intruder")
    expect(tracker.childrenOf("parent")).toEqual(["child"])
    const removed = tracker.unlink("parent")
    expect(removed).toEqual(["child"])
    removed.push("intruder")
    expect(tracker.childrenOf("parent")).toEqual([])
  })
})

describe("cleanup error reporting is best-effort", () => {
  it("keeps clearing resources when the error reporter itself throws", () => {
    const registry = new ResourceRegistry()
    const tracker = new ResourceTracker()
    const destroyed: string[] = []

    for (const id of ["a", "b", "c"]) {
      registry.add(
        createHandle({
          id,
          type: "polygon",
          native: {},
          onDestroy: () => {
            destroyed.push(id)
            if (id === "b") throw new Error("boom")
          },
        }),
      )
    }

    const collected = registry.clear(tracker, () => {
      throw new Error("reporter failed")
    })

    expect(destroyed).toEqual(expect.arrayContaining(["a", "b", "c"]))
    expect(collected).toHaveLength(1)
    expect(registry.ids()).toEqual([])
    expect(tracker.size).toBe(0)
  })

  it("keeps running disposers when the error reporter itself throws", async () => {
    const stack = new DisposerStack()
    const order: string[] = []
    stack.push(() => {
      order.push("first")
    })
    stack.push(() => {
      order.push("failing")
      throw new Error("boom")
    })
    stack.push(() => {
      order.push("last")
    })

    await stack.disposeAll(() => {
      throw new Error("reporter failed")
    })

    expect(order).toEqual(["last", "failing", "first"])
    expect(stack.size).toBe(0)
  })
})
