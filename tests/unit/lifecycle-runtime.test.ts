import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  CapabilityRegistry,
  CommandBus,
  DisposerStack,
  EventBus,
  LifecycleManager,
  PluginScopeManager,
  ResourceRegistry,
  ResourceTracker,
  ToolRegistry,
  createHandle,
  getRuntimeDiagnostics,
  registerAtomically,
  type Arc3DContext,
} from "@arc3dlab/core"

describe("LifecycleManager FSM", () => {
  it("allows only created -> initializing -> ready -> destroying -> destroyed", () => {
    const life = new LifecycleManager()
    expect(() => life.transition("ready")).toThrow(Arc3DError)
    life.transition("initializing")
    life.transition("ready")
    life.transition("destroying")
    life.transition("destroyed")
    expect(life.current).toBe("destroyed")
    expect(life.isTerminating).toBe(true)
  })

  it("treats repeated destroy transitions as idempotent", () => {
    const life = new LifecycleManager()
    life.transition("destroying")
    life.transition("destroying")
    life.transition("destroyed")
    life.transition("destroyed")
    expect(life.current).toBe("destroyed")
    expect(() => life.assertUsable("add graphic")).toThrow(Arc3DError)
  })

  it("blocks work while destroying", () => {
    const life = new LifecycleManager()
    life.transition("destroying")
    expect(life.isTerminating).toBe(true)
    expect(() => life.assertUsable("flyTo")).toThrow(Arc3DError)
  })
})

describe("DisposerStack", () => {
  it("runs disposers in reverse and continues after a failure", async () => {
    const stack = new DisposerStack()
    const order: string[] = []
    const errors: unknown[] = []
    stack.push(() => {
      order.push("first")
    })
    stack.push(() => {
      throw new Error("mid")
    })
    stack.push(() => {
      order.push("last")
    })
    await stack.disposeAll((error) => errors.push(error))
    expect(order).toEqual(["last", "first"])
    expect(errors).toHaveLength(1)
    expect(stack.size).toBe(0)
  })
})

describe("borrowed resources", () => {
  it("unregisters borrowed resources without destroying native objects", () => {
    const registry = new ResourceRegistry()
    let destroyed = false
    const handle = createHandle({
      id: "borrowed-1",
      type: "tileset",
      native: { keep: true },
      owned: false,
      onDestroy: () => {
        destroyed = true
      },
    })
    registry.add(handle)
    handle.destroy()
    registry.clear()
    expect(destroyed).toBe(false)
    expect(registry.get("borrowed-1")).toBeUndefined()
  })
})

describe("EventBus isolation", () => {
  it("keeps remaining handlers running after one throws", () => {
    const seen: string[] = []
    const bus = new EventBus<{
      ping: { n: number }
      error: { message: string }
    }>({
      onHandlerError: () => {
        seen.push("logged")
      },
    })
    bus.on("ping", () => {
      throw new Error("h1")
    })
    bus.on("ping", (payload) => {
      seen.push(`ok:${payload.n}`)
    })
    bus.on("error", (payload) => {
      seen.push(`err:${payload.message}`)
    })
    bus.emit("ping", { n: 1 })
    expect(seen).toEqual(["logged", "err:h1", "ok:1"])
  })

  it("does not recurse when an error handler throws", () => {
    let errorCalls = 0
    const bus = new EventBus<{ error: { message: string } }>({
      onHandlerError: () => {
        errorCalls += 10
      },
    })
    bus.on("error", () => {
      errorCalls += 1
      throw new Error("nested")
    })
    bus.emit("error", { message: "root" })
    expect(errorCalls).toBe(11)
  })
})

describe("resource registration", () => {
  it("destroys tracked children before the parent", () => {
    const registry = new ResourceRegistry()
    const tracker = new ResourceTracker()
    const order: string[] = []
    registry.add(
      createHandle({
        id: "parent",
        type: "polygon",
        native: {},
        onDestroy: () => {
          order.push("parent")
        },
      }),
    )
    registry.add(
      createHandle({
        id: "parent#fill",
        type: "polygon-fill",
        native: {},
        onDestroy: () => {
          order.push("fill")
        },
      }),
    )
    tracker.link("parent", "parent#fill")
    registry.clear(tracker)
    expect(order).toEqual(["fill", "parent"])
    expect(tracker.size).toBe(0)
  })

  it("rolls back native work when registration fails", () => {
    const registry = new ResourceRegistry()
    registry.add(createHandle({ id: "dup", type: "point", native: {} }))
    let rolledBack = false
    expect(() =>
      registerAtomically(
        registry,
        createHandle({ id: "dup", type: "point", native: {} }),
        () => {
          rolledBack = true
        },
      ),
    ).toThrow(Arc3DError)
    expect(rolledBack).toBe(true)
  })
})

describe("runtime diagnostics", () => {
  it("counts resources, listeners, and disposers", () => {
    const registry = new ResourceRegistry()
    const tracker = new ResourceTracker()
    const events = new EventBus<{ ping: number }>()
    const disposers = new DisposerStack()
    registry.add(createHandle({ id: "g1", type: "polygon", native: {} }))
    registry.add(createHandle({ id: "g2", type: "polygon", native: {} }))
    tracker.link("g1", "g1#fill")
    events.on("ping", () => undefined)
    disposers.push(() => undefined)
    const snapshot = getRuntimeDiagnostics({
      lifecycle: new LifecycleManager(),
      registry,
      tracker,
      events,
      disposers,
      capabilities: new CapabilityRegistry(),
      commands: new CommandBus(),
      tools: new ToolRegistry(),
      scopes: new PluginScopeManager(),
    } as unknown as Arc3DContext)
    expect(snapshot.lifecycle).toBe("created")
    expect(snapshot.resources).toEqual({ polygon: 2 })
    expect(snapshot.listenerCount).toBe(1)
    expect(snapshot.disposerCount).toBe(1)
    expect(snapshot.trackedParents).toBe(1)
    expect(snapshot.tools).toBe(0)
    expect(snapshot.activeTool).toBeNull()
    expect(snapshot.pluginScopes).toEqual([])
  })
})
